import { IAgent, IAgentConfig } from './IAgent';

/**
 * Gets all output paths for an agent, taking into account any config overrides.
 */
export function getAgentOutputPaths(
  agent: IAgent,
  projectRoot: string,
  agentConfig?: IAgentConfig,
): string[] {
  const paths: string[] = [];
  const defaults = agent.getDefaultOutputPath(projectRoot);

  if (typeof defaults === 'string') {
    // Single output path (most agents)
    const actualPath = agentConfig?.outputPath ?? defaults;
    paths.push(actualPath);
  } else {
    // Multiple output paths (e.g., AiderAgent)
    const defaultPaths = defaults as Record<string, string>;

    // Handle instructions path
    if ('instructions' in defaultPaths) {
      const instructionsPath =
        agentConfig?.outputPath ??
        agentConfig?.outputPathInstructions ??
        defaultPaths.instructions;
      paths.push(instructionsPath);
    }

    // Handle config/MCP path
    const configKey = 'config' in defaultPaths ? 'config' : 'mcp';
    if (configKey in defaultPaths) {
      const configPath =
        agentConfig?.outputPathConfig ?? defaultPaths[configKey];
      paths.push(configPath);
    }

    // Handle any other paths in the default paths record
    for (const [key, defaultPath] of Object.entries(defaultPaths)) {
      if (key !== 'instructions' && key !== configKey) {
        // For unknown path types, use the default since we don't have specific config overrides
        paths.push(defaultPath);
      }
    }
  }

  return paths;
}
