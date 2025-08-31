import { IAgent, IAgentConfig } from './agents/IAgent';
import { allAgents } from './agents';
import { McpStrategy } from './types';
import { logVerbose } from './constants';
import {
  loadSingleConfiguration,
  processHierarchicalConfigurations,
  processSingleConfiguration,
  updateGitignore,
  loadNestedConfigurations,
} from './core/apply-engine';
import { type LoadedConfig } from './core/ConfigLoader';
import { mapRawAgentConfigs } from './core/config-utils';
import { resolveSelectedAgents } from './core/agent-selection';

const agents: IAgent[] = allAgents;

export { allAgents };

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
    );

    if (hierarchicalConfigs.length === 0) {
      throw new Error('No .ruler directories found');
    }

    // Use the root config for agent selection (all levels share the same agent settings)
    const rootConfig = hierarchicalConfigs[0].config;
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

    normalizeAgentConfigs(rootConfig, agents);

    selectedAgents = resolveSelectedAgents(rootConfig, agents);
    logVerbose(
      `Selected ${selectedAgents.length} agents: ${selectedAgents.map((a) => a.getName()).join(', ')}`,
      verbose,
    );

    generatedPaths = await processHierarchicalConfigurations(
      selectedAgents,
      hierarchicalConfigs,
      verbose,
      dryRun,
      cliMcpEnabled,
      cliMcpStrategy,
      backup,
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

    generatedPaths = await processSingleConfiguration(
      selectedAgents,
      singleConfig,
      projectRoot,
      verbose,
      dryRun,
      cliMcpEnabled,
      cliMcpStrategy,
      backup,
    );
  }

  await updateGitignore(
    projectRoot,
    generatedPaths,
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
