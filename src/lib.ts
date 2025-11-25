import * as path from 'path';
import { allAgents } from './agents';
import type { IAgent, IAgentConfig } from './agents/IAgent';
import { logVerbose, logWarn } from './constants';
import { resolveSelectedAgents } from './core/agent-selection';
import {
  type HierarchicalSkillerConfiguration,
  loadNestedConfigurations,
  loadSingleConfiguration,
  processHierarchicalConfigurations,
  processSingleConfiguration,
  updateGitignore,
} from './core/apply-engine';
import type { LoadedConfig } from './core/ConfigLoader';
import { mapRawAgentConfigs } from './core/config-utils';
import type { McpStrategy } from './types';

const agents: IAgent[] = allAgents;

export { allAgents };

/**
 * Resolves skills enabled state based on precedence: CLI flag > skiller.toml > default (enabled)
 */
function resolveSkillsEnabled(
  cliFlag: boolean | undefined,
  configSetting: boolean | undefined,
): boolean {
  return cliFlag !== undefined
    ? cliFlag
    : configSetting !== undefined
      ? configSetting
      : true; // default to enabled
}

/**
 * Resolves backup setting from CLI flag, config file, or default.
 * Precedence: CLI > Config > Default (true)
 */
function resolveBackupEnabled(
  cliFlag: boolean | undefined,
  configSetting: boolean | undefined,
): boolean {
  return cliFlag !== undefined
    ? cliFlag
    : configSetting !== undefined
      ? configSetting
      : true; // default to enabled
}

/**
 * Applies skiller configurations for all supported AI agents.
 * @param projectRoot Root directory of the project
 */
/**
 * Applies skiller configurations for selected AI agents.
 * @param projectRoot Root directory of the project
 * @param includedAgents Optional list of agent name filters (case-insensitive substrings)
 */
export async function applyAllAgentConfigs(
  projectRoot: string,
  includedAgents?: string[],
  configPath?: string,
  cliMcpEnabled = true,
  cliMcpStrategy?: McpStrategy,
  cliGitignoreEnabled?: boolean,
  verbose = false,
  dryRun = false,
  localOnly = false,
  nested = false,
  cliBackupEnabled?: boolean,
  skillsEnabled?: boolean,
): Promise<void> {
  // Load configuration and rules
  logVerbose(
    `Loading configuration from project root: ${projectRoot}`,
    verbose,
  );
  if (configPath) {
    logVerbose(`Using custom config path: ${configPath}`, verbose);
  }

  let selectedAgents: IAgent[];
  let generatedPaths: string[];
  let loadedConfig: LoadedConfig;

  if (nested) {
    const hierarchicalConfigs = await loadNestedConfigurations(
      projectRoot,
      configPath,
      localOnly,
      nested,
    );

    if (hierarchicalConfigs.length === 0) {
      throw new Error('No .claude directories found');
    }

    logWarn(
      'Nested mode is experimental and may change in future releases.',
      dryRun,
    );

    // Use the root config for agent selection (all levels share the same agent settings)
    const rootConfigEntry = selectRootConfiguration(
      hierarchicalConfigs,
      projectRoot,
    );
    const rootConfig = rootConfigEntry.config;
    loadedConfig = rootConfig;
    rootConfig.cliAgents = includedAgents;

    logVerbose(
      `Loaded ${hierarchicalConfigs.length} .claude directory configurations`,
      verbose,
    );
    logVerbose(
      `Root configuration has ${Object.keys(rootConfig.agentConfigs).length} agent configs`,
      verbose,
    );

    for (const configEntry of hierarchicalConfigs) {
      normalizeAgentConfigs(configEntry.config, agents);
    }

    selectedAgents = resolveSelectedAgents(rootConfig, agents);
    logVerbose(
      `Selected ${selectedAgents.length} agents: ${selectedAgents.map((a) => a.getName()).join(', ')}`,
      verbose,
    );

    // Propagate skills (or cleanup if disabled) - do this for each nested directory
    const skillsEnabledResolved = resolveSkillsEnabled(
      skillsEnabled,
      rootConfig.skills?.enabled,
    );
    const { propagateSkills, generateSkillsFromRules } = await import(
      './core/SkillsProcessor'
    );

    // Generate skills from .mdc files if enabled
    if (skillsEnabledResolved) {
      const generateFromRules = rootConfig.skills?.generate_from_rules ?? false;
      if (generateFromRules) {
        for (const configEntry of hierarchicalConfigs) {
          const nestedRoot = path.dirname(configEntry.skillerDir);
          logVerbose(
            `Generating skills from .mdc files for nested directory: ${nestedRoot}`,
            verbose,
          );
          await generateSkillsFromRules(
            nestedRoot,
            configEntry.skillerDir,
            verbose,
            dryRun,
          );
        }
      }
    }

    // Propagate skills for each nested .claude directory (or cleanup if disabled)
    for (const configEntry of hierarchicalConfigs) {
      const nestedRoot = path.dirname(configEntry.skillerDir);
      logVerbose(
        `Propagating skills for nested directory: ${nestedRoot}`,
        verbose,
      );
      await propagateSkills(
        nestedRoot,
        selectedAgents,
        skillsEnabledResolved,
        verbose,
        dryRun,
        configEntry.skillerDir,
      );
    }

    // Resolve backup setting: CLI > Config > Default (true)
    const backupResolved = resolveBackupEnabled(
      cliBackupEnabled,
      rootConfig.backup?.enabled,
    );

    generatedPaths = await processHierarchicalConfigurations(
      selectedAgents,
      hierarchicalConfigs,
      verbose,
      dryRun,
      cliMcpEnabled,
      cliMcpStrategy,
      backupResolved,
      skillsEnabledResolved,
    );
  } else {
    const singleConfig = await loadSingleConfiguration(
      projectRoot,
      configPath,
      localOnly,
    );

    loadedConfig = singleConfig.config;
    singleConfig.config.cliAgents = includedAgents;

    logVerbose(
      `Loaded configuration with ${Object.keys(singleConfig.config.agentConfigs).length} agent configs`,
      verbose,
    );
    logVerbose(
      `Found .claude directory with ${singleConfig.concatenatedRules.length} characters of rules`,
      verbose,
    );

    normalizeAgentConfigs(singleConfig.config, agents);

    selectedAgents = resolveSelectedAgents(singleConfig.config, agents);
    logVerbose(
      `Selected ${selectedAgents.length} agents: ${selectedAgents.map((a) => a.getName()).join(', ')}`,
      verbose,
    );

    // Propagate skills (or cleanup if disabled)
    const skillsEnabledResolved = resolveSkillsEnabled(
      skillsEnabled,
      singleConfig.config.skills?.enabled,
    );
    const { propagateSkills, generateSkillsFromRules } = await import(
      './core/SkillsProcessor'
    );

    // Generate skills from .mdc files if enabled
    if (skillsEnabledResolved) {
      const generateFromRules =
        singleConfig.config.skills?.generate_from_rules ?? false;
      if (generateFromRules) {
        logVerbose('Generating skills from .mdc files', verbose);
        await generateSkillsFromRules(
          projectRoot,
          singleConfig.skillerDir,
          verbose,
          dryRun,
        );
      }
    }

    // Always call propagateSkills - it handles cleanup when disabled
    await propagateSkills(
      projectRoot,
      selectedAgents,
      skillsEnabledResolved,
      verbose,
      dryRun,
      singleConfig.skillerDir,
    );

    // Resolve backup setting: CLI > Config > Default (true)
    const backupResolved = resolveBackupEnabled(
      cliBackupEnabled,
      singleConfig.config.backup?.enabled,
    );

    generatedPaths = await processSingleConfiguration(
      selectedAgents,
      singleConfig,
      projectRoot,
      verbose,
      dryRun,
      cliMcpEnabled,
      cliMcpStrategy,
      backupResolved,
      skillsEnabledResolved,
    );
  }

  // Add skills-generated paths to gitignore if skills are enabled
  let allGeneratedPaths = generatedPaths;
  const skillsEnabledForGitignore = resolveSkillsEnabled(
    skillsEnabled,
    loadedConfig.skills?.enabled,
  );
  if (skillsEnabledForGitignore) {
    // Skills enabled by default or explicitly
    const { getSkillsGitignorePaths } = await import('./core/SkillsProcessor');
    const skillsPaths = await getSkillsGitignorePaths(projectRoot);
    allGeneratedPaths = [...generatedPaths, ...skillsPaths];
  }

  await updateGitignore(
    projectRoot,
    allGeneratedPaths,
    loadedConfig,
    cliGitignoreEnabled,
    dryRun,
  );
}

/**
 * Normalizes per-agent config keys to agent identifiers for consistent lookup.
 * Maps both exact identifier matches and substring matches with agent names.
 * @param config The configuration object to normalize
 * @param agents Array of available agents
 */
function normalizeAgentConfigs(
  config: { agentConfigs: Record<string, IAgentConfig> },
  agents: IAgent[],
): void {
  // Normalize per-agent config keys to agent identifiers (exact match or substring match)
  config.agentConfigs = mapRawAgentConfigs(config.agentConfigs, agents);
}

function selectRootConfiguration(
  configurations: HierarchicalSkillerConfiguration[],
  projectRoot: string,
): HierarchicalSkillerConfiguration {
  if (configurations.length === 0) {
    throw new Error('No hierarchical configurations available');
  }

  const normalizedProjectRoot = path.resolve(projectRoot);
  let bestIndex = -1;
  let bestDepth = Number.POSITIVE_INFINITY;

  for (let i = 0; i < configurations.length; i++) {
    const entry = configurations[i];
    const normalizedDir = path.resolve(entry.skillerDir);

    if (!normalizedDir.startsWith(normalizedProjectRoot)) {
      continue;
    }

    const depth = normalizedDir.split(path.sep).length;
    if (depth < bestDepth) {
      bestDepth = depth;
      bestIndex = i;
    }
  }

  if (bestIndex === -1) {
    return configurations[0];
  }

  return configurations[bestIndex];
}
