import { IAgent } from '../agents/IAgent';
import { LoadedConfig } from './ConfigLoader';
import { createRulerError } from '../constants';

/**
 * Resolves which agents should be selected based on configuration.
 * Handles precedence: CLI agents > default_agents > per-agent enabled flags > all agents
 *
 * @param config Loaded configuration containing CLI agents, default agents, and per-agent configs
 * @param allAgents Array of all available agents
 * @returns Array of agents that should be processed
 */
export function resolveSelectedAgents(
  config: LoadedConfig,
  allAgents: IAgent[],
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
