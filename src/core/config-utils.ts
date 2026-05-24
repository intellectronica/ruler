import { IAgent, IAgentConfig } from '../agents/IAgent';

/**
 * Maps raw agent configuration keys to their corresponding agent identifiers.
 *
 * This function normalizes configuration keys by matching them against agent identifiers
 * and display names. It performs both exact matching (case-insensitive) with agent
 * identifiers and substring matching (case-insensitive) with agent display names
 * for backwards compatibility.
 *
 * @param raw Raw agent configurations with user-provided keys
 * @param agents Array of all available agents
 * @returns Record with agent identifiers as keys and their configurations as values
 */
export function mapRawAgentConfigs(
  raw: Record<string, IAgentConfig>,
  agents: IAgent[],
): Record<string, IAgentConfig> {
  const mappedConfigs: Record<string, IAgentConfig> = {};

  for (const [key, cfg] of Object.entries(raw)) {
    const lowerKey = key.toLowerCase();
    const exactMatches = agents.filter(
      (agent) => agent.getIdentifier().toLowerCase() === lowerKey,
    );

    // Exact identifier matches take precedence over fuzzy display-name matching.
    if (exactMatches.length > 0) {
      for (const agent of exactMatches) {
        mappedConfigs[agent.getIdentifier()] = cfg;
      }
      continue;
    }

    for (const agent of agents) {
      const identifier = agent.getIdentifier();
      if (agent.getName().toLowerCase().includes(lowerKey)) {
        mappedConfigs[identifier] = cfg;
      }
    }
  }

  return mappedConfigs;
}
