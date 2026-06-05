import { McpStrategy } from '../types';

const MCP_SERVER_KEYS = [
  'mcp',
  'mcpServers',
  'servers',
  'mcp_servers',
  'context_servers',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collectMcpServers(
  config: Record<string, unknown>,
  serverKey: string,
): Record<string, unknown> {
  const servers: Record<string, unknown> = {};
  const aliases = MCP_SERVER_KEYS.filter((key) => key !== serverKey);

  for (const key of [...aliases, serverKey]) {
    const value = config[key];
    if (isRecord(value)) {
      Object.assign(servers, value);
    }
  }

  return servers;
}

function removeServerAliases(
  config: Record<string, unknown>,
  serverKey: string,
): Record<string, unknown> {
  const result = { ...config };
  for (const key of MCP_SERVER_KEYS) {
    if (key !== serverKey) {
      delete result[key];
    }
  }
  return result;
}

/**
 * Merge native and incoming MCP server configurations according to strategy.
 * @param base Existing native MCP config object.
 * @param incoming Ruler MCP config object.
 * @param strategy Merge strategy: 'merge' to union servers, 'overwrite' to replace.
 * @param serverKey The key to use for servers in the output (e.g., 'servers' for Copilot, 'mcpServers' for others).
 * @returns Merged MCP config object.
 */
export function mergeMcp(
  base: Record<string, unknown>,
  incoming: Record<string, unknown>,
  strategy: McpStrategy,
  serverKey: string,
): Record<string, unknown> {
  if (strategy === 'overwrite') {
    const incomingServers = collectMcpServers(incoming, serverKey);
    const preservedBase = removeServerAliases(base, serverKey);
    return {
      ...preservedBase,
      [serverKey]: incomingServers,
    };
  }

  const baseServers = collectMcpServers(base, serverKey);
  const incomingServers = collectMcpServers(incoming, serverKey);

  const mergedServers = { ...baseServers, ...incomingServers };
  const newBase = removeServerAliases(base, serverKey);

  return {
    ...newBase,
    [serverKey]: mergedServers,
  } as Record<string, unknown>;
}
