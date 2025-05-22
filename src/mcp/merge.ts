import { McpStrategy } from '../types';

/**
 * Merge native and incoming MCP server configurations according to strategy.
 * @param base Existing native MCP config object.
 * @param incoming Ruler MCP config object.
 * @param strategy Merge strategy: 'merge' to union servers, 'overwrite' to replace.
 * @returns Merged MCP config object.
 */
export function mergeMcp(
  base: Record<string, unknown>,
  incoming: Record<string, unknown>,
  strategy: McpStrategy,
): Record<string, unknown> {
  if (strategy === 'overwrite') {
    return incoming;
  }
  const baseServers = (base.mcpServers as Record<string, unknown>) || {};
  const incomingServers =
    (incoming.mcpServers as Record<string, unknown>) || {};
  return {
    ...base,
    mcpServers: { ...baseServers, ...incomingServers },
  } as Record<string, unknown>;
}
