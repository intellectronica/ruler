import { IAgent } from './agents/IAgent';
import { CopilotAgent } from './agents/CopilotAgent';
import { ClaudeAgent } from './agents/ClaudeAgent';
import { CodexCliAgent } from './agents/CodexCliAgent';
import { CursorAgent } from './agents/CursorAgent';
import { WindsurfAgent } from './agents/WindsurfAgent';
import { ClineAgent } from './agents/ClineAgent';
import { AiderAgent } from './agents/AiderAgent';
import { FirebaseAgent } from './agents/FirebaseAgent';
import { OpenHandsAgent } from './agents/OpenHandsAgent';
import { GeminiCliAgent } from './agents/GeminiCliAgent';
import { JulesAgent } from './agents/JulesAgent';
import { JunieAgent } from './agents/JunieAgent';
import { AugmentCodeAgent } from './agents/AugmentCodeAgent';
import { KiloCodeAgent } from './agents/KiloCodeAgent';
import { OpenCodeAgent } from './agents/OpenCodeAgent';
import { CrushAgent } from './agents/CrushAgent';
import { GooseAgent } from './agents/GooseAgent';
import { AmpAgent } from './agents/AmpAgent';
import { McpStrategy } from './types';
import { logVerbose } from './constants';
import {
  loadRulerConfiguration,
  selectAgentsToRun,
  applyConfigurationsToAgents,
  updateGitignore,
} from './core/apply-engine';

const agents: IAgent[] = [
  new CopilotAgent(),
  new ClaudeAgent(),
  new CodexCliAgent(),
  new CursorAgent(),
  new WindsurfAgent(),
  new ClineAgent(),
  new AiderAgent(),
  new FirebaseAgent(),
  new OpenHandsAgent(),
  new GeminiCliAgent(),
  new JulesAgent(),
  new JunieAgent(),
  new AugmentCodeAgent(),
  new KiloCodeAgent(),
  new OpenCodeAgent(),
  new GooseAgent(),
  new CrushAgent(),
  new AmpAgent(),
];

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
  const rawConfigs = rulerConfiguration.config.agentConfigs;
  const mappedConfigs: Record<string, (typeof rawConfigs)[string]> = {};
  for (const [key, cfg] of Object.entries(rawConfigs)) {
    const lowerKey = key.toLowerCase();
    for (const agent of agents) {
      const identifier = agent.getIdentifier();
      // Exact match with identifier or substring match with display name for backwards compatibility
      if (
        identifier === lowerKey ||
        agent.getName().toLowerCase().includes(lowerKey)
      ) {
        mappedConfigs[identifier] = cfg;
      }
    }
  }
  rulerConfiguration.config.agentConfigs = mappedConfigs;

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
