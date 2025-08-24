import * as fs from 'fs/promises';
import * as TOML from 'toml';
import { stringify } from '@iarna/toml';
import { ensureDirExists } from '../core/FileSystemUtils';
import * as path from 'path';

interface RemoteServer {
  url: string;
}

interface RulerMcpServer {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

function isRulerMcpServer(value: unknown): value is RulerMcpServer {
  const server = value as RulerMcpServer;
  return (
    server &&
    (typeof server.command === 'string' || typeof server.url === 'string')
  );
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

  // Always use the legacy Ruler MCP config format as input (top-level "mcpServers" key)
  const rulerServers = rulerMcp.mcpServers || {};

  let config: {
    mcp?: {
      servers?: Record<string, RemoteServer>;
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
  if (!config.mcp.servers) {
    config.mcp.servers = {};
  }

  // Only add servers that have URLs (remote servers)
  // Skip local servers entirely since OpenHands doesn't support them
  for (const [name, serverDef] of Object.entries(rulerServers)) {
    if (isRulerMcpServer(serverDef) && serverDef.url) {
      config.mcp.servers[name] = { url: serverDef.url };
    }
  }

  await ensureDirExists(path.dirname(openHandsConfigPath));
  await fs.writeFile(openHandsConfigPath, stringify(config));
}
