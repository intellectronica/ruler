import { IAgent } from '../agents/IAgent';

/**
 * MCP capability types for agents
 */
export interface McpCapabilities {
  supportsStdio: boolean;
  supportsRemote: boolean;
}

/**
 * Derives MCP capabilities for an agent
 */
export function getAgentMcpCapabilities(agent: IAgent): McpCapabilities {
  return {
    supportsStdio: agent.supportsMcpStdio?.() ?? false,
    supportsRemote: agent.supportsMcpRemote?.() ?? false,
  };
}

/**
 * Checks if an agent supports any MCP functionality
 */
export function agentSupportsMcp(agent: IAgent): boolean {
  const capabilities = getAgentMcpCapabilities(agent);
  return capabilities.supportsStdio || capabilities.supportsRemote;
}

function getMcpRemoteHeaderArgs(headers: unknown): string[] {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
    return [];
  }

  return Object.entries(headers).flatMap(([key, value]) =>
    typeof value === 'string' ? ['--header', `${key}: ${value}`] : [],
  );
}

/**
 * Filters MCP configuration based on agent capabilities
 */
export function filterMcpConfigForAgent(
  mcpConfig: Record<string, unknown>,
  agent: IAgent,
): Record<string, unknown> | null {
  const capabilities = getAgentMcpCapabilities(agent);

  if (!agentSupportsMcp(agent)) {
    return null;
  }

  const servers = mcpConfig.mcpServers as Record<string, unknown>;
  if (!servers) {
    return null;
  }

  const filteredServers: Record<string, unknown> = {};

  for (const [serverName, serverConfig] of Object.entries(servers)) {
    const config = serverConfig as Record<string, unknown>;

    // Determine server type
    const hasCommand =
      typeof config.command === 'string' || Array.isArray(config.command);
    const hasUrl = typeof config.url === 'string';

    const isStdio = hasCommand && !hasUrl;
    const isRemote = hasUrl && !hasCommand;

    // Include server if agent supports its type
    if (isStdio && capabilities.supportsStdio) {
      filteredServers[serverName] = serverConfig;
    } else if (isRemote && capabilities.supportsRemote) {
      filteredServers[serverName] = serverConfig;
    } else if (
      isRemote &&
      !capabilities.supportsRemote &&
      capabilities.supportsStdio
    ) {
      // Transform remote server to stdio server using mcp-remote
      const preservedFields = Object.fromEntries(
        Object.entries(config).filter(
          ([key]) =>
            !['url', 'command', 'args', 'type', 'headers'].includes(key),
        ),
      );
      const headerArgs = getMcpRemoteHeaderArgs(config.headers);
      const transformedConfig = {
        command: 'npx',
        args: ['-y', 'mcp-remote@latest', config.url as string, ...headerArgs],
        ...preservedFields,
      };
      filteredServers[serverName] = transformedConfig;
    }
    // Note: Mixed servers (both command and url) are excluded
  }

  return Object.keys(filteredServers).length > 0
    ? { mcpServers: filteredServers }
    : null;
}
