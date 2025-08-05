/**
 * Validate the structure of the Ruler MCP JSON config.
 * Minimal validation: ensure 'mcpServers' property exists and is an object.
 * @param data Parsed JSON object from .ruler/mcp.json.
 * @throws Error if validation fails.
 */
export function validateMcp(data: unknown): void {
  if (
    !data ||
    typeof data !== 'object' ||
    !('mcpServers' in data) ||
    typeof (data as Record<string, unknown>).mcpServers !== 'object'
  ) {
    throw new Error(
      '[ruler] Invalid MCP config: must contain an object property "mcpServers" (Ruler style)',
    );
  }
}
