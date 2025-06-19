import * as fs from 'fs/promises';
import TOML from '@iarna/toml';
import { ensureDirExists } from '../core/FileSystemUtils';
import * as path from 'path';
/* eslint-disable @typescript-eslint/no-explicit-any */

interface StdioServer {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export async function propagateMcpToOpenHands(
  rulerMcpPath: string,
  openHandsConfigPath: string,
): Promise<void> {
  let rulerMcp;
  try {
    const rulerJsonContent = await fs.readFile(rulerMcpPath, 'utf8');
    rulerMcp = JSON.parse(rulerJsonContent);
  } catch {
    return;
  }

  const rulerServers = rulerMcp.mcpServers || {};

  let config: any = {};
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
    const { command, args, env } = serverDef as any;
    if (command) {
      const newServer: StdioServer = { name, command };
      if (args) newServer.args = args;
      if (env) newServer.env = env;
      existingServers.set(name, newServer);
    }
  }

  config.mcp.stdio_servers = Array.from(existingServers.values());

  await ensureDirExists(path.dirname(openHandsConfigPath));
  await fs.writeFile(openHandsConfigPath, TOML.stringify(config));
}
