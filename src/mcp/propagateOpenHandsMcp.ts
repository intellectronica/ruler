import * as fs from 'fs/promises';
import * as TOML from 'toml';
import { stringify } from '@iarna/toml';
import { ensureDirExists } from '../core/FileSystemUtils';
import * as path from 'path';

interface StdioServer {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface RulerMcpServer {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

function isRulerMcpServer(value: unknown): value is RulerMcpServer {
  const server = value as RulerMcpServer;
  return server && typeof server.command === 'string';
}

export async function propagateMcpToOpenHands(
  rulerMcpData: Record<string, unknown> | null,
  openHandsConfigPath: string,
): Promise<void> {
  const rulerMcp: Record<string, unknown> = rulerMcpData || {};

  // Always use the legacy Ruler MCP config format as input (top-level "mcpServers" key)
  const rulerServers = rulerMcp.mcpServers || {};

  // Return early if no servers to process
  if (
    !rulerServers ||
    typeof rulerServers !== 'object' ||
    Object.keys(rulerServers).length === 0
  ) {
    return;
  }

  let config: {
    mcp?: {
      stdio_servers?: StdioServer[];
    };
  } = {};
  try {
    const tomlContent = await fs.readFile(openHandsConfigPath, 'utf8');
    config = TOML.parse(tomlContent);
  } catch {
    // File doesn't exist, we'll create it.
  }

  if (!config.mcp) {
    config.mcp = {};
  }
  if (!config.mcp.stdio_servers) {
    config.mcp.stdio_servers = [];
  }

  const existingServers = new Map<string, StdioServer>(
    config.mcp.stdio_servers.map((s: StdioServer) => [s.name, s]),
  );

  for (const [name, serverDef] of Object.entries(rulerServers)) {
    if (isRulerMcpServer(serverDef)) {
      const { command, args, env } = serverDef;
      const newServer: StdioServer = { name, command };
      if (args) newServer.args = args;
      if (env) newServer.env = env;
      existingServers.set(name, newServer);
    }
  }

  config.mcp.stdio_servers = Array.from(existingServers.values());

  await ensureDirExists(path.dirname(openHandsConfigPath));
  await fs.writeFile(openHandsConfigPath, stringify(config));
}
