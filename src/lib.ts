import * as path from 'path';
import { IAgent, IAgentConfig } from './agents/IAgent';
import { allAgents } from './agents';
import { McpStrategy } from './types';
import { logError, logVerbose, logWarn } from './constants';
import {
  loadSingleConfiguration,
  processHierarchicalConfigurations,
  processSingleConfiguration,
  updateGitignore,
  loadNestedConfigurations,
  HierarchicalRulerConfiguration,
  RulerConfiguration,
} from './core/apply-engine';
import { type LoadedConfig } from './core/ConfigLoader';
import type { ConfigDiagnostic } from './core/UnifiedConfigTypes';
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
 * Resolves backup enabled state based on precedence:
 * CLI flag > ruler.toml > default (enabled).
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
 * Resolves subagents enabled state based on precedence:
 * CLI flag > ruler.toml > default (disabled).
 *
 * When neither `[agents] enabled` (nor the legacy `[subagents] enabled`)
 * nor a CLI flag is provided, propagation is disabled by default per spec.
 * Subagent definitions are an opt-in feature — propagating them silently
 * could leak runtime prompts into native subagent locations on projects
 * that never intended to use the feature.
 */
function resolveSubagentsEnabled(
  cliFlag: boolean | undefined,
  configSetting: boolean | undefined,
): boolean {
  return cliFlag !== undefined
    ? cliFlag
    : configSetting !== undefined
      ? configSetting
      : false; // default to disabled — see spec: subagents must opt in
}

function resolveSubagentsCleanupOrphaned(
  configSetting: boolean | undefined,
): boolean {
  return configSetting === true;
}

function emitConfigDiagnostics(
  configurations: Array<Pick<RulerConfiguration, 'diagnostics'>>,
  dryRun: boolean,
): void {
  const emitted = new Set<string>();

  for (const configuration of configurations) {
    for (const diagnostic of configuration.diagnostics ?? []) {
      if (diagnostic.code === 'MCP_JSON_DEPRECATED') {
        continue;
      }

      const key = JSON.stringify({
        code: diagnostic.code,
        message: diagnostic.message,
        file: diagnostic.file,
        detail: diagnostic.detail,
      });
      if (emitted.has(key)) {
        continue;
      }
      emitted.add(key);

      const message = formatConfigDiagnostic(diagnostic);
      if (diagnostic.severity === 'error') {
        logError(message, dryRun);
      } else {
        logWarn(message, dryRun);
      }
    }
  }
}

function formatConfigDiagnostic(diagnostic: ConfigDiagnostic): string {
  const details = [
    diagnostic.file ? `File: ${diagnostic.file}` : undefined,
    diagnostic.detail ? `Detail: ${diagnostic.detail}` : undefined,
  ].filter(Boolean);
  const suffix = details.length > 0 ? ` (${details.join(', ')})` : '';
  return `Configuration ${diagnostic.severity} [${diagnostic.code}]: ${diagnostic.message}${suffix}`;
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
  backup?: boolean,
  skillsEnabled?: boolean,
  cliGitignoreLocal?: boolean,
  subagentsEnabled?: boolean,
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
  let outputProjectRoot = projectRoot;
  const gitignoreConfigurations: Array<{
    projectRoot: string;
    config: LoadedConfig;
    selectedAgents?: IAgent[];
  }> = [];

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

    emitConfigDiagnostics(hierarchicalConfigs, dryRun);

    logWarn(
      'Nested mode is experimental and may change in future releases.',
      dryRun,
    );

    const rootConfigEntry = selectRootConfiguration(
      hierarchicalConfigs,
      projectRoot,
    );
    const rootConfig = rootConfigEntry.config;
    loadedConfig = rootConfig;

    logVerbose(
      `Loaded ${hierarchicalConfigs.length} .ruler directory configurations`,
      verbose,
    );
    logVerbose(
      `Root configuration has ${Object.keys(rootConfig.agentConfigs).length} agent configs`,
      verbose,
    );

    const selectedAgentsByRulerDir = new Map<string, IAgent[]>();
    for (const configEntry of hierarchicalConfigs) {
      configEntry.config.cliAgents = includedAgents;
      normalizeAgentConfigs(configEntry.config, agents);
      const configSelectedAgents = resolveSelectedAgents(
        configEntry.config,
        agents,
      );
      selectedAgentsByRulerDir.set(configEntry.rulerDir, configSelectedAgents);
    }

    selectedAgents =
      selectedAgentsByRulerDir.get(rootConfigEntry.rulerDir) ??
      resolveSelectedAgents(rootConfig, agents);
    logVerbose(
      `Selected ${selectedAgents.length} agents for root configuration: ${selectedAgents.map((a) => a.getName()).join(', ')}`,
      verbose,
    );

    const { propagateSkills } = await import('./core/SkillsProcessor');
    // Propagate or clean up skills for each nested .ruler directory.
    for (const configEntry of hierarchicalConfigs) {
      const nestedRoot = path.dirname(configEntry.rulerDir);
      const configSelectedAgents =
        selectedAgentsByRulerDir.get(configEntry.rulerDir) ?? selectedAgents;
      gitignoreConfigurations.push({
        projectRoot: nestedRoot,
        config: configEntry.config,
        selectedAgents: configSelectedAgents,
      });
      const skillsEnabledResolved = resolveSkillsEnabled(
        skillsEnabled,
        configEntry.config.skills?.enabled,
      );
      logVerbose(
        `Propagating skills for nested directory: ${nestedRoot}`,
        verbose,
      );
      await propagateSkills(
        nestedRoot,
        configSelectedAgents,
        skillsEnabledResolved,
        verbose,
        dryRun,
      );
    }

    // Propagate subagents (mirrors skills handling for nested mode).
    const subagentsEnabledResolved = resolveSubagentsEnabled(
      subagentsEnabled,
      rootConfig.subagents?.enabled,
    );
    const subagentsCleanupOrphaned = resolveSubagentsCleanupOrphaned(
      rootConfig.subagents?.cleanup_orphaned,
    );
    const backupEnabledResolved = resolveBackupEnabled(
      backup,
      rootConfig.backup?.enabled,
    );
    {
      const { propagateSubagents } = await import('./core/SubagentsProcessor');
      for (const configEntry of hierarchicalConfigs) {
        const nestedRoot = path.dirname(configEntry.rulerDir);
        const configSelectedAgents =
          selectedAgentsByRulerDir.get(configEntry.rulerDir) ?? selectedAgents;
        logVerbose(
          `Propagating subagents for nested directory: ${nestedRoot}`,
          verbose,
        );
        await propagateSubagents(
          nestedRoot,
          configSelectedAgents,
          subagentsEnabledResolved,
          subagentsCleanupOrphaned,
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
      backupEnabledResolved,
      selectedAgentsByRulerDir,
    );
  } else {
    const singleConfig = await loadSingleConfiguration(
      projectRoot,
      configPath,
      localOnly,
    );
    const singleProjectRoot = singleConfig.projectRoot;
    outputProjectRoot = singleProjectRoot;

    emitConfigDiagnostics([singleConfig], dryRun);

    loadedConfig = singleConfig.config;
    gitignoreConfigurations.push({
      projectRoot: singleProjectRoot,
      config: singleConfig.config,
    });
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
    const { propagateSkills } = await import('./core/SkillsProcessor');
    await propagateSkills(
      singleProjectRoot,
      selectedAgents,
      skillsEnabledResolved,
      verbose,
      dryRun,
    );

    // Propagate subagents (mirrors skills handling).
    const subagentsEnabledResolvedSingle = resolveSubagentsEnabled(
      subagentsEnabled,
      singleConfig.config.subagents?.enabled,
    );
    const subagentsCleanupOrphanedSingle = resolveSubagentsCleanupOrphaned(
      singleConfig.config.subagents?.cleanup_orphaned,
    );
    const backupEnabledResolvedSingle = resolveBackupEnabled(
      backup,
      singleConfig.config.backup?.enabled,
    );
    {
      const { propagateSubagents } = await import('./core/SubagentsProcessor');
      await propagateSubagents(
        singleProjectRoot,
        selectedAgents,
        subagentsEnabledResolvedSingle,
        subagentsCleanupOrphanedSingle,
        verbose,
        dryRun,
      );
    }

    generatedPaths = await processSingleConfiguration(
      selectedAgents,
      singleConfig,
      singleProjectRoot,
      verbose,
      dryRun,
      cliMcpEnabled,
      cliMcpStrategy,
      backupEnabledResolvedSingle,
    );
  }

  // Add skills-generated paths to gitignore if skills are enabled
  let allGeneratedPaths = generatedPaths;
  const skillsEnabledGitignoreConfigurations = gitignoreConfigurations.filter(
    (entry) =>
      resolveSkillsEnabled(skillsEnabled, entry.config.skills?.enabled),
  );
  if (skillsEnabledGitignoreConfigurations.length > 0) {
    const { getSkillsGitignorePaths } = await import('./core/SkillsProcessor');
    for (const entry of skillsEnabledGitignoreConfigurations) {
      const skillsPaths = await getSkillsGitignorePaths(
        entry.projectRoot,
        entry.selectedAgents ?? selectedAgents,
      );
      allGeneratedPaths = [...allGeneratedPaths, ...skillsPaths];
    }
  }

  // Add subagents-generated paths to gitignore if subagents are enabled.
  const subagentsEnabledForGitignore = resolveSubagentsEnabled(
    subagentsEnabled,
    loadedConfig.subagents?.enabled,
  );
  if (subagentsEnabledForGitignore) {
    const { getSubagentsGitignorePaths } = await import(
      './core/SubagentsProcessor'
    );
    const subagentPaths = await getSubagentsGitignorePaths(
      outputProjectRoot,
      selectedAgents,
    );
    allGeneratedPaths = [...allGeneratedPaths, ...subagentPaths];
  }

  await updateGitignore(
    outputProjectRoot,
    allGeneratedPaths,
    loadedConfig,
    cliGitignoreEnabled,
    dryRun,
    cliGitignoreLocal,
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
