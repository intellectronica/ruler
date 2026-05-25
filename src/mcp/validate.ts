/**
 * Validate the structure of the Ruler MCP JSON config.
 * Minimal validation: ensure 'mcpServers' property exists and is an object.
 * @param data Parsed JSON object from .ruler/mcp.json.
 * @throws Error if validation fails.
 */
export function validateMcp(data: unknown): void {
  const mcpServers =
    data && typeof data === 'object'
      ? (data as Record<string, unknown>).mcpServers
      : undefined;

  if (
    !data ||
    typeof data !== 'object' ||
    !('mcpServers' in data) ||
    !mcpServers ||
    typeof mcpServers !== 'object' ||
    Array.isArray(mcpServers)
  ) {
    throw new Error(
      '[ruler] Invalid MCP config: must contain an object property "mcpServers" (Ruler style)',
    );
  }
}
