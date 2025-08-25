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

  return mappedConfigs;
}
