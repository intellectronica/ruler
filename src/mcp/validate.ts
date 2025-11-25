/**
 * Validate the structure of the Skiller MCP JSON config.
 * Minimal validation: ensure 'mcpServers' property exists and is an object.
 * @param data Parsed JSON object from .claude/mcp.json.
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
      '[skiller] Invalid MCP config: must contain an object property "mcpServers" (Skiller style)',
    );
  }
}
