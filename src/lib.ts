import { IAgent } from './agents/IAgent';
import { allAgents } from './agents';
import { McpStrategy } from './types';
import { logVerbose } from './constants';
import {
  loadRulerConfiguration,
  selectAgentsToRun,
  applyConfigurationsToAgents,
  updateGitignore,
} from './core/apply-engine';
import { mapRawAgentConfigs } from './core/config-utils';

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
): Promise<void> {
  // Load configuration and rules
  logVerbose(
    `Loading configuration from project root: ${projectRoot}`,
    verbose,
  );
  if (configPath) {
    logVerbose(`Using custom config path: ${configPath}`, verbose);
  }

  const rulerConfiguration = await loadRulerConfiguration(
    projectRoot,
    configPath,
    localOnly,
  );

  // Add CLI agents to the configuration
  rulerConfiguration.config.cliAgents = includedAgents;

  logVerbose(
    `Loaded configuration with ${Object.keys(rulerConfiguration.config.agentConfigs).length} agent configs`,
    verbose,
  );
  logVerbose(
    `Found .ruler directory with ${rulerConfiguration.concatenatedRules.length} characters of rules`,
    verbose,
  );

  // Normalize per-agent config keys to agent identifiers (exact match or substring match)
  rulerConfiguration.config.agentConfigs = mapRawAgentConfigs(
    rulerConfiguration.config.agentConfigs,
    agents,
  );

  // Select agents to run
  const selectedAgents = selectAgentsToRun(agents, rulerConfiguration.config);
  logVerbose(
    `Selected ${selectedAgents.length} agents: ${selectedAgents.map((a) => a.getName()).join(', ')}`,
    verbose,
  );

  // Apply configurations to agents
  const generatedPaths = await applyConfigurationsToAgents(
    selectedAgents,
    rulerConfiguration.concatenatedRules,
    rulerConfiguration.rulerMcpJson,
    rulerConfiguration.config,
    projectRoot,
    verbose,
    dryRun,
    cliMcpEnabled,
    cliMcpStrategy,
  );

  // Update .gitignore
  await updateGitignore(
    projectRoot,
    generatedPaths,
    rulerConfiguration.config,
    cliGitignoreEnabled,
    dryRun,
  );
}
