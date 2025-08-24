import * as path from 'path';
import { promises as fs } from 'fs';
import * as FileSystemUtils from './FileSystemUtils';
import { concatenateRules } from './RuleProcessor';
import { loadConfig, LoadedConfig, IAgentConfig } from './ConfigLoader';
import { updateGitignore as updateGitignoreUtil } from './GitignoreUtils';
import { IAgent } from '../agents/IAgent';
import { mergeMcp } from '../mcp/merge';
import { getNativeMcpPath, readNativeMcp, writeNativeMcp } from '../paths/mcp';
import { propagateMcpToOpenHands } from '../mcp/propagateOpenHandsMcp';
import { propagateMcpToOpenCode } from '../mcp/propagateOpenCodeMcp';
import { getAgentOutputPaths } from '../agents/agent-utils';
import { createRulerError, logVerbose } from '../constants';
import { McpStrategy } from '../types';

// Global set to track warnings issued for MCP server/agent combinations
const mcpWarningsIssued = new Set<string>();

/**
 * Issue a warning once per MCP server and agent combination.
 */
function issueOnceWarning(
  agentName: string,
  serverName: string,
  message: string,
): void {
  const key = `${agentName}:${serverName}`;
  if (!mcpWarningsIssued.has(key)) {
    console.warn(`[ruler] Warning: ${message}`);
    mcpWarningsIssued.add(key);
  }
}

/**
 * Determines if an MCP server configuration is local (STDIO) or remote (HTTP).
 */
function isRemoteServer(serverConfig: unknown): boolean {
  const config = serverConfig as Record<string, unknown>;
  return config && typeof config.url === 'string';
}

function isLocalServer(serverConfig: unknown): boolean {
  const config = serverConfig as Record<string, unknown>;
  return (
    config &&
    (typeof config.command === 'string' || Array.isArray(config.command))
  );
}

/**
 * Transforms local MCP servers to use mcp-remote for agents that don't support remote servers.
 */
/**
 * Transforms local MCP servers to remote via supergateway for agents that don't support local servers.
 */
function transformLocalToRemoteViaSupergateway(
  rulerMcpJson: Record<string, unknown>,
  agentName: string,
): Record<string, unknown> {
  const mcpServers = (rulerMcpJson.mcpServers as Record<string, unknown>) || {};
  const transformedServers: Record<string, unknown> = {};

  for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
    if (isLocalServer(serverConfig)) {
      // Issue warning and transform via supergateway
      issueOnceWarning(
        agentName,
        serverName,
        `Agent ${agentName} doesn't support local MCP servers. Using supergateway as fallback for server "${serverName}".`,
      );

      const config = serverConfig as {
        command: string | string[];
        args?: string[];
        env?: Record<string, string>;
      };
      const command = Array.isArray(config.command)
        ? config.command
        : [config.command];
      const args = config.args || [];

      // Transform to supergateway configuration to proxy local server as remote
      transformedServers[serverName] = {
        command: 'npx',
        args: ['supergateway', '--stdio', ...command, ...args],
        env: config.env,
      };
    } else {
      // Keep remote servers as-is
      transformedServers[serverName] = serverConfig;
    }
  }

  return { ...rulerMcpJson, mcpServers: transformedServers };
}

/**
 * Transforms remote MCP servers to local via mcp-remote for agents that don't support remote servers.
 */
function transformRemoteToLocalViaMcpRemote(
  rulerMcpJson: Record<string, unknown>,
  agentName: string,
): Record<string, unknown> {
  const mcpServers = (rulerMcpJson.mcpServers as Record<string, unknown>) || {};
  const transformedServers: Record<string, unknown> = {};

  for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
    if (isRemoteServer(serverConfig)) {
      // Issue warning and transform via mcp-remote
      issueOnceWarning(
        agentName,
        serverName,
        `Agent ${agentName} doesn't support remote MCP servers. Using mcp-remote as fallback for server "${serverName}".`,
      );

      const config = serverConfig as {
        url: string;
        headers?: Record<string, string>;
      };

      // Transform to mcp-remote configuration to access remote server locally
      transformedServers[serverName] = {
        command: 'npx',
        args: ['mcp-remote', config.url],
      };
    } else {
      // Keep local servers as-is
      transformedServers[serverName] = serverConfig;
    }
  }

  return { ...rulerMcpJson, mcpServers: transformedServers };
}

/**
 * Configuration data loaded from the ruler setup
 */
export interface RulerConfiguration {
  config: LoadedConfig;
  concatenatedRules: string;
  rulerMcpJson: Record<string, unknown> | null;
}

/**
 * Loads all necessary configurations for ruler operation.
 * @param projectRoot Root directory of the project
 * @param configPath Optional custom config path
 * @param localOnly Whether to search only locally for .ruler directory
 * @returns Promise resolving to the loaded configuration
 */
export async function loadRulerConfiguration(
  projectRoot: string,
  configPath: string | undefined,
  localOnly: boolean,
): Promise<RulerConfiguration> {
  // Find the .ruler directory
  const rulerDir = await FileSystemUtils.findRulerDir(projectRoot, !localOnly);
  if (!rulerDir) {
    throw createRulerError(
      `.ruler directory not found`,
      `Searched from: ${projectRoot}`,
    );
  }

  // Early legacy mcp.json existence warning (some code paths may not parse it)
  try {
    const legacyMcpPath = path.join(rulerDir, 'mcp.json');
    await (await import('fs/promises')).access(legacyMcpPath);
    console.warn(
      '[ruler] Warning: Using legacy .ruler/mcp.json. Please migrate to ruler.toml. This fallback will be removed in a future release.',
    );
  } catch {
    // ignore
  }

  // Load the ruler.toml configuration
  const config = await loadConfig({
    projectRoot,
    configPath,
  });

  // Read and concatenate the markdown rule files
  const files = await FileSystemUtils.readMarkdownFiles(rulerDir);
  const concatenatedRules = concatenateRules(files, path.dirname(rulerDir));

  // Load unified config to get merged MCP configuration
  const { loadUnifiedConfig } = await import('./UnifiedConfigLoader');
  const unifiedConfig = await loadUnifiedConfig({ projectRoot, configPath });

  // Synthesize rulerMcpJson from unified MCP bundle for backward compatibility
  let rulerMcpJson: Record<string, unknown> | null = null;
  if (unifiedConfig.mcp && Object.keys(unifiedConfig.mcp.servers).length > 0) {
    rulerMcpJson = {
      mcpServers: unifiedConfig.mcp.servers,
    };
  }

  return {
    config,
    concatenatedRules,
    rulerMcpJson,
  };
}

/**
 * Selects the agents to process based on configuration.
 * @param allAgents Array of all available agents
 * @param config Loaded configuration
 * @returns Array of agents to be processed
 */
export function selectAgentsToRun(
  allAgents: IAgent[],
  config: LoadedConfig,
): IAgent[] {
  // CLI --agents > config.default_agents > per-agent.enabled flags > default all
  let selected = allAgents;

  if (config.cliAgents && config.cliAgents.length > 0) {
    const filters = config.cliAgents.map((n) => n.toLowerCase());

    // Check if any of the specified agents don't exist
    const validAgentIdentifiers = new Set(
      allAgents.map((agent) => agent.getIdentifier()),
    );
    const validAgentNames = new Set(
      allAgents.map((agent) => agent.getName().toLowerCase()),
    );

    const invalidAgents = filters.filter(
      (filter) =>
        !validAgentIdentifiers.has(filter) &&
        ![...validAgentNames].some((name) => name.includes(filter)),
    );

    if (invalidAgents.length > 0) {
      throw createRulerError(
        `Invalid agent specified: ${invalidAgents.join(', ')}`,
        `Valid agents are: ${[...validAgentIdentifiers].join(', ')}`,
      );
    }

    selected = allAgents.filter((agent) =>
      filters.some(
        (f) =>
          agent.getIdentifier() === f ||
          agent.getName().toLowerCase().includes(f),
      ),
    );
  } else if (config.defaultAgents && config.defaultAgents.length > 0) {
    const defaults = config.defaultAgents.map((n) => n.toLowerCase());

    // Check if any of the default agents don't exist
    const validAgentIdentifiers = new Set(
      allAgents.map((agent) => agent.getIdentifier()),
    );
    const validAgentNames = new Set(
      allAgents.map((agent) => agent.getName().toLowerCase()),
    );

    const invalidAgents = defaults.filter(
      (filter) =>
        !validAgentIdentifiers.has(filter) &&
        ![...validAgentNames].some((name) => name.includes(filter)),
    );

    if (invalidAgents.length > 0) {
      throw createRulerError(
        `Invalid agent specified in default_agents: ${invalidAgents.join(', ')}`,
        `Valid agents are: ${[...validAgentIdentifiers].join(', ')}`,
      );
    }

    selected = allAgents.filter((agent) => {
      const identifier = agent.getIdentifier();
      const override = config.agentConfigs[identifier]?.enabled;
      if (override !== undefined) {
        return override;
      }
      return defaults.some(
        (d) => identifier === d || agent.getName().toLowerCase().includes(d),
      );
    });
  } else {
    selected = allAgents.filter(
      (agent) => config.agentConfigs[agent.getIdentifier()]?.enabled !== false,
    );
  }

  return selected;
}

/**
 * Applies configurations to the selected agents.
 * @param agents Array of agents to process
 * @param concatenatedRules Concatenated rule content
 * @param rulerMcpJson MCP configuration JSON
 * @param config Loaded configuration
 * @param projectRoot Root directory of the project
 * @param verbose Whether to enable verbose logging
 * @param dryRun Whether to perform a dry run
 * @returns Promise resolving to array of generated file paths
 */
export async function applyConfigurationsToAgents(
  agents: IAgent[],
  concatenatedRules: string,
  rulerMcpJson: Record<string, unknown> | null,
  config: LoadedConfig,
  projectRoot: string,
  verbose: boolean,
  dryRun: boolean,
  cliMcpEnabled = true,
  cliMcpStrategy?: McpStrategy,
): Promise<string[]> {
  const generatedPaths: string[] = [];
  let agentsMdWritten = false;

  for (const agent of agents) {
    const actionPrefix = dryRun ? '[ruler:dry-run]' : '[ruler]';
    console.log(`${actionPrefix} Applying rules for ${agent.getName()}...`);
    logVerbose(`Processing agent: ${agent.getName()}`, verbose);
    const agentConfig = config.agentConfigs[agent.getIdentifier()];

    // Collect output paths for .gitignore
    const outputPaths = getAgentOutputPaths(agent, projectRoot, agentConfig);
    logVerbose(
      `Agent ${agent.getName()} output paths: ${outputPaths.join(', ')}`,
      verbose,
    );
    generatedPaths.push(...outputPaths);

    // Also add the backup file paths to the gitignore list
    const backupPaths = outputPaths.map((p) => `${p}.bak`);
    generatedPaths.push(...backupPaths);

    if (dryRun) {
      logVerbose(
        `DRY RUN: Would write rules to: ${outputPaths.join(', ')}`,
        verbose,
      );
    } else {
      let skipApplyForThisAgent = false;
      if (
        agent.getIdentifier() === 'jules' ||
        agent.getIdentifier() === 'agentsmd'
      ) {
        if (agentsMdWritten) {
          // Skip rewriting AGENTS.md, but still allow MCP handling below
          skipApplyForThisAgent = true;
        } else {
          agentsMdWritten = true;
        }
      }
      let finalAgentConfig = agentConfig;
      if (agent.getIdentifier() === 'augmentcode' && rulerMcpJson) {
        const resolvedStrategy =
          cliMcpStrategy ??
          agentConfig?.mcp?.strategy ??
          config.mcp?.strategy ??
          'merge';

        finalAgentConfig = {
          ...agentConfig,
          mcp: {
            ...agentConfig?.mcp,
            strategy: resolvedStrategy,
          },
        };
      }

      if (!skipApplyForThisAgent) {
        // Transform MCP configuration based on agent capabilities before passing to agent
        let transformedMcpJson = rulerMcpJson;
        if (rulerMcpJson) {
          const supportsLocal = agent.supportsLocalMcp?.() ?? true;
          const supportsRemote = agent.supportsRemoteMcp?.() ?? true;
          const supportsMcp = agent.supportsMcp?.() ?? true;

          if (!supportsMcp) {
            transformedMcpJson = null; // Don't pass MCP config to agents that don't support it
          } else if (!supportsRemote && hasRemoteServers(rulerMcpJson)) {
            transformedMcpJson = transformRemoteToLocalViaMcpRemote(
              rulerMcpJson,
              agent.getName(),
            );
          } else if (!supportsLocal && hasLocalServers(rulerMcpJson)) {
            transformedMcpJson = transformLocalToRemoteViaSupergateway(
              rulerMcpJson,
              agent.getName(),
            );
          }
        }

        await agent.applyRulerConfig(
          concatenatedRules,
          projectRoot,
          transformedMcpJson,
          finalAgentConfig,
        );
      }
    }

    // Handle MCP configuration
    await handleMcpConfiguration(
      agent,
      agentConfig,
      config,
      rulerMcpJson,
      projectRoot,
      generatedPaths,
      verbose,
      dryRun,
      cliMcpEnabled,
      cliMcpStrategy,
    );
  }

  return generatedPaths;
}

/**
 * Handles MCP configuration for a specific agent.
 */
async function handleMcpConfiguration(
  agent: IAgent,
  agentConfig: IAgentConfig | undefined,
  config: LoadedConfig,
  rulerMcpJson: Record<string, unknown> | null,
  projectRoot: string,
  generatedPaths: string[],
  verbose: boolean,
  dryRun: boolean,
  cliMcpEnabled = true,
  cliMcpStrategy?: McpStrategy,
): Promise<void> {
  const dest = await getNativeMcpPath(agent.getName(), projectRoot);
  const mcpEnabledForAgent =
    cliMcpEnabled && (agentConfig?.mcp?.enabled ?? config.mcp?.enabled ?? true);
  const rulerDir = await FileSystemUtils.findRulerDir(projectRoot, true);
  const rulerMcpFile = rulerDir ? path.join(rulerDir, 'mcp.json') : '';

  // Check if agent supports MCP at all
  const supportsMcp = agent.supportsMcp?.() ?? true;

  if (!supportsMcp) {
    if (rulerMcpJson && Object.keys(rulerMcpJson.mcpServers || {}).length > 0) {
      // Issue warning once for the agent (using a dummy server name)
      issueOnceWarning(
        agent.getName(),
        'any',
        `Agent ${agent.getName()} doesn't support MCP servers. MCP configuration will be ignored.`,
      );
    }
    return;
  }

  if (dest && mcpEnabledForAgent) {
    // Include MCP config file in .gitignore only if it's within the project directory
    if (dest.startsWith(projectRoot)) {
      const relativeDest = path.relative(projectRoot, dest);
      generatedPaths.push(relativeDest);
      // Also add the backup for the MCP file
      generatedPaths.push(`${relativeDest}.bak`);
    }

    if (agent.getIdentifier() === 'openhands') {
      // *** Special handling for Open Hands ***
      // OpenHands uses TOML format, so we need special handling
      if (dryRun) {
        logVerbose(
          `DRY RUN: Would apply MCP config by updating TOML file: ${dest}`,
          verbose,
        );
      } else {
        // Check capabilities and transform if needed
        const supportsLocal = agent.supportsLocalMcp?.() ?? true;
        const supportsRemote = agent.supportsRemoteMcp?.() ?? true;

        let transformedMcpJson = rulerMcpJson;

        if (rulerMcpJson && !supportsRemote && hasRemoteServers(rulerMcpJson)) {
          transformedMcpJson = transformRemoteToLocalViaMcpRemote(
            rulerMcpJson,
            agent.getName(),
          );
        } else if (
          rulerMcpJson &&
          !supportsLocal &&
          hasLocalServers(rulerMcpJson)
        ) {
          transformedMcpJson = transformLocalToRemoteViaSupergateway(
            rulerMcpJson,
            agent.getName(),
          );
        }

        // Write the transformed configuration to a temporary file for OpenHands propagation
        const tmpMcpFile = path.join(
          path.dirname(rulerMcpFile),
          'tmp-mcp.json',
        );
        if (transformedMcpJson) {
          await fs.writeFile(
            tmpMcpFile,
            JSON.stringify(transformedMcpJson, null, 2),
          );
          await propagateMcpToOpenHands(tmpMcpFile, dest);
          // Clean up temporary file
          try {
            await fs.unlink(tmpMcpFile);
          } catch {
            // Ignore cleanup errors
          }
        } else {
          await propagateMcpToOpenHands(rulerMcpFile, dest);
        }
      }
    } else if (agent.getIdentifier() === 'augmentcode') {
      // *** Special handling for AugmentCode ***
      // AugmentCode handles MCP configuration internally in applyRulerConfig
      if (dryRun) {
        logVerbose(
          `DRY RUN: AugmentCode MCP config handled internally via VSCode settings`,
          verbose,
        );
      }
    } else if (agent.getIdentifier() === 'opencode') {
      // *** Special handling for OpenCode ***
      if (dryRun) {
        logVerbose(
          `DRY RUN: Would apply MCP config by updating OpenCode config file: ${dest}`,
          verbose,
        );
      } else {
        await propagateMcpToOpenCode(rulerMcpJson, dest);
      }
    } else {
      if (rulerMcpJson) {
        const strategy =
          cliMcpStrategy ??
          agentConfig?.mcp?.strategy ??
          config.mcp?.strategy ??
          'merge';

        // Check agent capabilities and transform configuration if needed
        const supportsLocal = agent.supportsLocalMcp?.() ?? true;
        const supportsRemote = agent.supportsRemoteMcp?.() ?? true;

        let transformedMcpJson = rulerMcpJson;

        // Transform configuration based on agent capabilities
        if (rulerMcpJson && !supportsRemote && hasRemoteServers(rulerMcpJson)) {
          transformedMcpJson = transformRemoteToLocalViaMcpRemote(
            rulerMcpJson,
            agent.getName(),
          );
        } else if (
          rulerMcpJson &&
          !supportsLocal &&
          hasLocalServers(rulerMcpJson)
        ) {
          transformedMcpJson = transformLocalToRemoteViaSupergateway(
            rulerMcpJson,
            agent.getName(),
          );
        }

        // Determine the correct server key for the agent
        const serverKey = agent.getMcpServerKey?.() ?? 'mcpServers';

        logVerbose(
          `Applying MCP config for ${agent.getName()} with strategy: ${strategy} and key: ${serverKey}`,
          verbose,
        );

        if (dryRun) {
          logVerbose(`DRY RUN: Would apply MCP config to: ${dest}`, true);
        } else {
          const existing = await readNativeMcp(dest);
          const merged = mergeMcp(
            existing,
            transformedMcpJson,
            strategy,
            serverKey,
          );
          await writeNativeMcp(dest, merged);
        }
      }
    }
  }
}

/**
 * Checks if the MCP configuration contains any remote servers.
 */
function hasRemoteServers(
  rulerMcpJson: Record<string, unknown> | null,
): boolean {
  if (!rulerMcpJson) return false;
  const mcpServers = (rulerMcpJson.mcpServers as Record<string, unknown>) || {};
  return Object.values(mcpServers).some(isRemoteServer);
}

/**
 * Checks if the MCP configuration contains any local servers.
 */
function hasLocalServers(
  rulerMcpJson: Record<string, unknown> | null,
): boolean {
  if (!rulerMcpJson) return false;
  const mcpServers = (rulerMcpJson.mcpServers as Record<string, unknown>) || {};
  return Object.values(mcpServers).some(isLocalServer);
}

/**
 * Updates the .gitignore file with generated paths.
 * @param projectRoot Root directory of the project
 * @param generatedPaths Array of generated file paths
 * @param config Loaded configuration
 * @param cliGitignoreEnabled CLI gitignore setting
 * @param dryRun Whether to perform a dry run
 */
export async function updateGitignore(
  projectRoot: string,
  generatedPaths: string[],
  config: LoadedConfig,
  cliGitignoreEnabled: boolean | undefined,
  dryRun: boolean,
): Promise<void> {
  // Configuration precedence: CLI > TOML > Default (enabled)
  let gitignoreEnabled: boolean;
  if (cliGitignoreEnabled !== undefined) {
    gitignoreEnabled = cliGitignoreEnabled;
  } else if (config.gitignore?.enabled !== undefined) {
    gitignoreEnabled = config.gitignore.enabled;
  } else {
    gitignoreEnabled = true; // Default enabled
  }

  if (gitignoreEnabled && generatedPaths.length > 0) {
    const uniquePaths = [...new Set(generatedPaths)];

    // Add wildcard pattern for backup files
    uniquePaths.push('*.bak');

    if (uniquePaths.length > 0) {
      const actionPrefix = dryRun ? '[ruler:dry-run]' : '[ruler]';
      if (dryRun) {
        console.log(
          `${actionPrefix} Would update .gitignore with ${uniquePaths.length} unique path(s): ${uniquePaths.join(', ')}`,
        );
      } else {
        await updateGitignoreUtil(projectRoot, uniquePaths);
        console.log(
          `${actionPrefix} Updated .gitignore with ${uniquePaths.length} unique path(s) in the Ruler block.`,
        );
      }
    }
  }
}
