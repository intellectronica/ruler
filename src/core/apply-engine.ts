import * as path from 'path';
import { promises as fs } from 'fs';
import * as FileSystemUtils from './FileSystemUtils';
import { concatenateRules } from './RuleProcessor';
import { loadConfig, LoadedConfig, IAgentConfig } from './ConfigLoader';
import { updateGitignore as updateGitignoreUtil } from './GitignoreUtils';
import { IAgent } from '../agents/IAgent';
import { validateMcp } from '../mcp/validate';
import { mergeMcp } from '../mcp/merge';
import { getNativeMcpPath, readNativeMcp, writeNativeMcp } from '../paths/mcp';
import { propagateMcpToOpenHands } from '../mcp/propagateOpenHandsMcp';
import { propagateMcpToOpenCode } from '../mcp/propagateOpenCodeMcp';
import { getAgentOutputPaths } from '../agents/agent-utils';
import { createRulerError, logVerbose } from '../constants';
import { McpStrategy } from '../types';

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

  // Load the ruler.toml configuration
  const config = await loadConfig({
    projectRoot,
    configPath,
  });

  // Read and concatenate the markdown rule files
  const files = await FileSystemUtils.readMarkdownFiles(rulerDir);
  const concatenatedRules = concatenateRules(files, path.dirname(rulerDir));

  // Load and validate the mcp.json file
  const mcpFile = path.join(rulerDir, 'mcp.json');
  let rulerMcpJson: Record<string, unknown> | null = null;
  try {
    const raw = await fs.readFile(mcpFile, 'utf8');
    rulerMcpJson = JSON.parse(raw) as Record<string, unknown>;
    validateMcp(rulerMcpJson);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw createRulerError(
        `Failed to load MCP configuration`,
        `File: ${mcpFile}, Error: ${(err as Error).message}`,
      );
    }
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
      if (
        agent.getIdentifier() === 'jules' ||
        agent.getIdentifier() === 'codex'
      ) {
        if (agentsMdWritten) {
          continue;
        }
        agentsMdWritten = true;
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

      await agent.applyRulerConfig(
        concatenatedRules,
        projectRoot,
        rulerMcpJson,
        finalAgentConfig,
      );
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
      if (dryRun) {
        logVerbose(
          `DRY RUN: Would apply MCP config by updating TOML file: ${dest}`,
          verbose,
        );
      } else {
        await propagateMcpToOpenHands(rulerMcpFile, dest);
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
        await propagateMcpToOpenCode(rulerMcpFile, dest);
      }
    } else {
      if (rulerMcpJson) {
        const strategy =
          cliMcpStrategy ??
          agentConfig?.mcp?.strategy ??
          config.mcp?.strategy ??
          'merge';

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
          const merged = mergeMcp(existing, rulerMcpJson, strategy, serverKey);
          await writeNativeMcp(dest, merged);
        }
      }
    }
  }
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
