import * as path from 'path';
import { IAgent, IAgentConfig } from './agents/IAgent';
import { allAgents } from './agents';
import { McpStrategy } from './types';
import { logVerbose, logWarn } from './constants';
import {
  loadSingleConfiguration,
  processHierarchicalConfigurations,
  processSingleConfiguration,
  updateGitignore,
  loadNestedConfigurations,
  HierarchicalRulerConfiguration,
} from './core/apply-engine';
import { type LoadedConfig } from './core/ConfigLoader';
import { mapRawAgentConfigs } from './core/config-utils';
import { resolveSelectedAgents } from './core/agent-selection';

const agents: IAgent[] = allAgents;

export { allAgents };

/**
 * Resolves skills enabled state based on precedence: CLI flag > ruler.toml > default (enabled)
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
 * Applies ruler configurations for all supported AI agents.
 * @param projectRoot Root directory of the project
 */
/**
 * Applies ruler configurations for selected AI agents.
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
  backup = true,
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
      throw new Error('No .ruler directories found');
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
      `Loaded ${hierarchicalConfigs.length} .ruler directory configurations`,
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

    // Propagate skills if enabled - do this for each nested directory
    const skillsEnabledResolved = resolveSkillsEnabled(
      skillsEnabled,
      rootConfig.skills?.enabled,
    );
    if (skillsEnabledResolved) {
      const { propagateSkills } = await import('./core/SkillsProcessor');
      // Propagate skills for each nested .ruler directory
      for (const configEntry of hierarchicalConfigs) {
        const nestedRoot = path.dirname(configEntry.rulerDir);
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
        );
      }
    }

    generatedPaths = await processHierarchicalConfigurations(
      selectedAgents,
      hierarchicalConfigs,
      verbose,
      dryRun,
      cliMcpEnabled,
      cliMcpStrategy,
      backup,
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
      `Found .ruler directory with ${singleConfig.concatenatedRules.length} characters of rules`,
      verbose,
    );

    normalizeAgentConfigs(singleConfig.config, agents);

    selectedAgents = resolveSelectedAgents(singleConfig.config, agents);
    logVerbose(
      `Selected ${selectedAgents.length} agents: ${selectedAgents.map((a) => a.getName()).join(', ')}`,
      verbose,
    );

    // Propagate skills if enabled
    const skillsEnabledResolved = resolveSkillsEnabled(
      skillsEnabled,
      singleConfig.config.skills?.enabled,
    );
    if (skillsEnabledResolved) {
      const { propagateSkills } = await import('./core/SkillsProcessor');
      await propagateSkills(
        projectRoot,
        selectedAgents,
        skillsEnabledResolved,
        verbose,
        dryRun,
      );
    }

    generatedPaths = await processSingleConfiguration(
      selectedAgents,
      singleConfig,
      projectRoot,
      verbose,
      dryRun,
      cliMcpEnabled,
      cliMcpStrategy,
      backup,
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
  configurations: HierarchicalRulerConfiguration[],
  projectRoot: string,
): HierarchicalRulerConfiguration {
  if (configurations.length === 0) {
    throw new Error('No hierarchical configurations available');
  }

  const normalizedProjectRoot = path.resolve(projectRoot);
  let bestIndex = -1;
  let bestDepth = Number.POSITIVE_INFINITY;

  for (let i = 0; i < configurations.length; i++) {
    const entry = configurations[i];
    const normalizedDir = path.resolve(entry.rulerDir);

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
