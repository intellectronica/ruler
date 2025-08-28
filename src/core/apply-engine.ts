import * as path from 'path';
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
import { agentSupportsMcp, filterMcpConfigForAgent } from '../mcp/capabilities';
import { createRulerError, logVerbose, actionPrefix } from '../constants';
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
 * Configuration data for a specific .ruler directory in hierarchical mode
 */
export interface HierarchicalRulerConfiguration extends RulerConfiguration {
  rulerDir: string;
}

export /**
 * Loads configurations for all .ruler directories in hierarchical mode.
 * Each .ruler directory gets its own independent configuration with separate rules.
 * @param projectRoot Root directory of the project
 * @param configPath Optional custom config path
 * @param localOnly Whether to search only locally for .ruler directories
 * @returns Promise resolving to array of hierarchical configurations
 */
async function loadNestedConfigurations(
  projectRoot: string,
  configPath: string | undefined,
  localOnly: boolean,
): Promise<HierarchicalRulerConfiguration[]> {
  const { dirs: rulerDirs } = await findRulerDirectories(
    projectRoot,
    localOnly,
    true,
  );

  const rootConfig = await loadConfig({
    projectRoot,
    configPath,
  });

  const results: HierarchicalRulerConfiguration[] = [];
  const rulerDirConfigs = await processIndependentRulerDirs(rulerDirs);

  for (const { rulerDir, files } of rulerDirConfigs) {
    results.push(
      await createHierarchicalConfiguration(rulerDir, files, rootConfig),
    );
  }

  return results;
}

/**
 * Processes each .ruler directory independently, returning configuration for each.
 * Each .ruler directory gets its own rules (not merged with others).
 */
async function processIndependentRulerDirs(
  rulerDirs: string[],
): Promise<
  Array<{ rulerDir: string; files: { path: string; content: string }[] }>
> {
  const results: Array<{
    rulerDir: string;
    files: { path: string; content: string }[];
  }> = [];

  // Process each .ruler directory independently
  for (const rulerDir of rulerDirs) {
    const files = await FileSystemUtils.readMarkdownFiles(rulerDir);
    results.push({ rulerDir, files });
  }

  return results;
}

async function createHierarchicalConfiguration(
  rulerDir: string,
  files: { path: string; content: string }[],
  rootConfig: LoadedConfig,
): Promise<HierarchicalRulerConfiguration> {
  await warnAboutLegacyMcpJson(rulerDir);

  const concatenatedRules = concatenateRules(files, path.dirname(rulerDir));

  return {
    rulerDir,
    config: rootConfig,
    concatenatedRules,
    rulerMcpJson: null, // No nested MCP support - each level uses root config only
  };
}

/**
 * Finds ruler directories based on the specified mode.
 */
async function findRulerDirectories(
  projectRoot: string,
  localOnly: boolean,
  hierarchical: boolean,
): Promise<{ dirs: string[]; primaryDir: string }> {
  if (hierarchical) {
    const dirs = await FileSystemUtils.findAllRulerDirs(projectRoot);
    const allDirs = [...dirs];

    // Add global config if not local-only
    if (!localOnly) {
      const globalDir = await FileSystemUtils.findGlobalRulerDir();
      if (globalDir) {
        allDirs.push(globalDir);
      }
    }

    if (allDirs.length === 0) {
      throw createRulerError(
        `.ruler directory not found`,
        `Searched from: ${projectRoot}`,
      );
    }
    return { dirs: allDirs, primaryDir: allDirs[0] };
  } else {
    const dir = await FileSystemUtils.findRulerDir(projectRoot, !localOnly);
    if (!dir) {
      throw createRulerError(
        `.ruler directory not found`,
        `Searched from: ${projectRoot}`,
      );
    }
    return { dirs: [dir], primaryDir: dir };
  }
}

/**
 * Warns about legacy mcp.json files if they exist.
 */
async function warnAboutLegacyMcpJson(rulerDir: string): Promise<void> {
  try {
    const legacyMcpPath = path.join(rulerDir, 'mcp.json');
    await (await import('fs/promises')).access(legacyMcpPath);
    console.warn(
      '[ruler] Warning: Using legacy .ruler/mcp.json. Please migrate to ruler.toml. This fallback will be removed in a future release.',
    );
  } catch {
    // ignore
  }
}

/**
 * Loads configuration for single-directory mode (existing behavior).
 */
export /**
 * Loads configuration for a single .ruler directory.
 * All rules from the directory are concatenated into a single configuration.
 * @param projectRoot Root directory of the project
 * @param configPath Optional custom config path
 * @param localOnly Whether to search only locally for .ruler directory
 * @returns Promise resolving to the loaded configuration
 */
async function loadSingleConfiguration(
  projectRoot: string,
  configPath: string | undefined,
  localOnly: boolean,
): Promise<RulerConfiguration> {
  // Find the single ruler directory
  const { dirs: rulerDirs, primaryDir } = await findRulerDirectories(
    projectRoot,
    localOnly,
    false, // single mode
  );

  // Warn about legacy mcp.json
  await warnAboutLegacyMcpJson(primaryDir);

  // Load the ruler.toml configuration
  const config = await loadConfig({
    projectRoot,
    configPath,
  });

  // Read rule files
  const files = await FileSystemUtils.readMarkdownFiles(rulerDirs[0]);

  // Concatenate rules
  const concatenatedRules = concatenateRules(files, path.dirname(primaryDir));

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
 * Processes hierarchical configurations by applying rules to each .ruler directory independently.
 * Each directory gets its own set of rules and generates its own agent files.
 * @param agents Array of agents to process
 * @param configurations Array of hierarchical configurations for each .ruler directory
 * @param verbose Whether to enable verbose logging
 * @param dryRun Whether to perform a dry run
 * @param cliMcpEnabled Whether MCP is enabled via CLI
 * @param cliMcpStrategy MCP strategy from CLI
 * @returns Promise resolving to array of generated file paths
 */
export async function processHierarchicalConfigurations(
  agents: IAgent[],
  configurations: HierarchicalRulerConfiguration[],
  verbose: boolean,
  dryRun: boolean,
  cliMcpEnabled: boolean,
  cliMcpStrategy?: McpStrategy,
  backup = true,
): Promise<string[]> {
  const allGeneratedPaths: string[] = [];

  for (const config of configurations) {
    console.log(`[ruler] Processing .ruler directory: ${config.rulerDir}`);
    const rulerRoot = path.dirname(config.rulerDir);
    const paths = await applyConfigurationsToAgents(
      agents,
      config.concatenatedRules,
      config.rulerMcpJson,
      config.config,
      rulerRoot,
      verbose,
      dryRun,
      cliMcpEnabled,
      cliMcpStrategy,
      backup,
    );
    allGeneratedPaths.push(...paths);
  }

  return allGeneratedPaths;
}

/**
 * Processes a single configuration by applying rules to all selected agents.
 * All rules are concatenated and applied to generate agent files in the project root.
 * @param agents Array of agents to process
 * @param configuration Single ruler configuration with concatenated rules
 * @param projectRoot Root directory of the project
 * @param verbose Whether to enable verbose logging
 * @param dryRun Whether to perform a dry run
 * @param cliMcpEnabled Whether MCP is enabled via CLI
 * @param cliMcpStrategy MCP strategy from CLI
 * @returns Promise resolving to array of generated file paths
 */
export async function processSingleConfiguration(
  agents: IAgent[],
  configuration: RulerConfiguration,
  projectRoot: string,
  verbose: boolean,
  dryRun: boolean,
  cliMcpEnabled: boolean,
  cliMcpStrategy?: McpStrategy,
  backup = true,
): Promise<string[]> {
  return await applyConfigurationsToAgents(
    agents,
    configuration.concatenatedRules,
    configuration.rulerMcpJson,
    configuration.config,
    projectRoot,
    verbose,
    dryRun,
    cliMcpEnabled,
    cliMcpStrategy,
    backup,
  );
}

/**
 * Applies configurations to the selected agents (internal function).
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
  backup = true,
): Promise<string[]> {
  const generatedPaths: string[] = [];
  let agentsMdWritten = false;

  for (const agent of agents) {
    const prefix = actionPrefix(dryRun);
    console.log(`${prefix} Applying rules for ${agent.getName()}...`);
    logVerbose(`Processing agent: ${agent.getName()}`, verbose);
    const agentConfig = config.agentConfigs[agent.getIdentifier()];

    // Collect output paths for .gitignore
    let outputPaths: string[];
    
    // Special handling for Windsurf agent to account for file splitting
    if (agent.getIdentifier() === 'windsurf' && 'getActualOutputPaths' in agent) {
      outputPaths = (agent as any).getActualOutputPaths(concatenatedRules, projectRoot, agentConfig);
    } else {
      outputPaths = getAgentOutputPaths(agent, projectRoot, agentConfig);
    }
    
    logVerbose(
      `Agent ${agent.getName()} output paths: ${outputPaths.join(', ')}`,
      verbose,
    );
    generatedPaths.push(...outputPaths);

    // Only add the backup file paths to the gitignore list if backups are enabled
    if (backup) {
      const backupPaths = outputPaths.map((p) => `${p}.bak`);
      generatedPaths.push(...backupPaths);
    }

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
        await agent.applyRulerConfig(
          concatenatedRules,
          projectRoot,
          rulerMcpJson,
          finalAgentConfig,
          backup,
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
      backup,
    );
  }

  return generatedPaths;
}

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
  backup = true,
): Promise<void> {
  if (!agentSupportsMcp(agent)) {
    logVerbose(
      `Agent ${agent.getName()} does not support MCP - skipping MCP configuration`,
      verbose,
    );
    return;
  }

  const dest = await getNativeMcpPath(agent.getName(), projectRoot);
  const mcpEnabledForAgent =
    cliMcpEnabled && (agentConfig?.mcp?.enabled ?? config.mcp?.enabled ?? true);

  if (!dest || !mcpEnabledForAgent || !rulerMcpJson) {
    return;
  }

  const filteredMcpJson = filterMcpConfigForAgent(rulerMcpJson, agent);
  if (!filteredMcpJson) {
    logVerbose(
      `No compatible MCP servers found for ${agent.getName()} - skipping MCP configuration`,
      verbose,
    );
    return;
  }

  await updateGitignoreForMcpFile(dest, projectRoot, generatedPaths, backup);
  await applyMcpConfiguration(
    agent,
    filteredMcpJson,
    dest,
    agentConfig,
    config,
    projectRoot,
    cliMcpStrategy,
    dryRun,
    verbose,
    backup,
  );
}

async function updateGitignoreForMcpFile(
  dest: string,
  projectRoot: string,
  generatedPaths: string[],
  backup = true,
): Promise<void> {
  if (dest.startsWith(projectRoot)) {
    const relativeDest = path.relative(projectRoot, dest);
    generatedPaths.push(relativeDest);
    if (backup) {
      generatedPaths.push(`${relativeDest}.bak`);
    }
  }
}

async function applyMcpConfiguration(
  agent: IAgent,
  filteredMcpJson: Record<string, unknown>,
  dest: string,
  agentConfig: IAgentConfig | undefined,
  config: LoadedConfig,
  projectRoot: string,
  cliMcpStrategy: McpStrategy | undefined,
  dryRun: boolean,
  verbose: boolean,
  backup = true,
): Promise<void> {
  // Prevent writing MCP configs outside the project root (e.g., legacy home-directory targets)
  if (!dest.startsWith(projectRoot)) {
    logVerbose(
      `Skipping MCP config for ${agent.getName()} because target path is outside project: ${dest}`,
      verbose,
    );
    return;
  }

  if (agent.getIdentifier() === 'openhands') {
    return await applyOpenHandsMcpConfiguration(
      filteredMcpJson,
      dest,
      dryRun,
      verbose,
      backup,
    );
  }

  if (agent.getIdentifier() === 'opencode') {
    return await applyOpenCodeMcpConfiguration(
      filteredMcpJson,
      dest,
      dryRun,
      verbose,
      backup,
    );
  }

  return await applyStandardMcpConfiguration(
    agent,
    filteredMcpJson,
    dest,
    agentConfig,
    config,
    cliMcpStrategy,
    dryRun,
    verbose,
    backup,
  );
}

async function applyOpenHandsMcpConfiguration(
  filteredMcpJson: Record<string, unknown>,
  dest: string,
  dryRun: boolean,
  verbose: boolean,
  backup = true,
): Promise<void> {
  if (dryRun) {
    logVerbose(
      `DRY RUN: Would apply MCP config by updating TOML file: ${dest}`,
      verbose,
    );
  } else {
    await propagateMcpToOpenHands(filteredMcpJson, dest, backup);
  }
}

async function applyOpenCodeMcpConfiguration(
  filteredMcpJson: Record<string, unknown>,
  dest: string,
  dryRun: boolean,
  verbose: boolean,
  backup = true,
): Promise<void> {
  if (dryRun) {
    logVerbose(
      `DRY RUN: Would apply MCP config by updating OpenCode config file: ${dest}`,
      verbose,
    );
  } else {
    await propagateMcpToOpenCode(filteredMcpJson, dest, backup);
  }
}

async function applyStandardMcpConfiguration(
  agent: IAgent,
  filteredMcpJson: Record<string, unknown>,
  dest: string,
  agentConfig: IAgentConfig | undefined,
  config: LoadedConfig,
  cliMcpStrategy: McpStrategy | undefined,
  dryRun: boolean,
  verbose: boolean,
  backup = true,
): Promise<void> {
  const strategy =
    cliMcpStrategy ??
    agentConfig?.mcp?.strategy ??
    config.mcp?.strategy ??
    'merge';
  const serverKey = agent.getMcpServerKey?.() ?? 'mcpServers';

  logVerbose(
    `Applying filtered MCP config for ${agent.getName()} with strategy: ${strategy} and key: ${serverKey}`,
    verbose,
  );

  if (dryRun) {
    logVerbose(`DRY RUN: Would apply MCP config to: ${dest}`, verbose);
  } else {
    if (backup) {
      const { backupFile } = await import('../core/FileSystemUtils');
      await backupFile(dest);
    }
    const existing = await readNativeMcp(dest);
    const merged = mergeMcp(existing, filteredMcpJson, strategy, serverKey);
    await writeNativeMcp(dest, merged);
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
  backup = true,
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

    // Add wildcard pattern for backup files only if backup is enabled
    if (backup) {
      uniquePaths.push('*.bak');
    }

    if (uniquePaths.length > 0) {
      const prefix = actionPrefix(dryRun);
      if (dryRun) {
        console.log(
          `${prefix} Would update .gitignore with ${uniquePaths.length} unique path(s): ${uniquePaths.join(', ')}`,
        );
      } else {
        await updateGitignoreUtil(projectRoot, uniquePaths);
        console.log(
          `${prefix} Updated .gitignore with ${uniquePaths.length} unique path(s) in the Ruler block.`,
        );
      }
    }
  }
}
