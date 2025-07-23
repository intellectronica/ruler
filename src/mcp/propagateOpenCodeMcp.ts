import * as fs from 'fs/promises';
import { ensureDirExists } from '../core/FileSystemUtils';
import * as path from 'path';
/* eslint-disable @typescript-eslint/no-explicit-any */

interface OpenCodeMcpServer {
  type: 'local' | 'remote';
  command?: string[];
  url?: string;
  enabled: boolean;
  environment?: Record<string, string>;
  headers?: Record<string, string>;
}

interface OpenCodeConfig {
  $schema: string;
  mcp: Record<string, OpenCodeMcpServer>;
}

/**
 * Transform ruler MCP configuration to OpenCode's specific format
 */
function transformToOpenCodeFormat(
  rulerMcp: Record<string, unknown>,
): OpenCodeConfig {
  const rulerServers = rulerMcp.mcpServers || {};
  const openCodeServers: Record<string, OpenCodeMcpServer> = {};

  for (const [name, serverDef] of Object.entries(rulerServers)) {
    const server = serverDef as any;

    // Determine if this is a local or remote server
    const isRemote = !!server.url;

    const openCodeServer: OpenCodeMcpServer = {
      type: isRemote ? 'remote' : 'local',
      enabled: true, // Always true as per the issue requirements
    };

    if (isRemote) {
      // Remote server configuration
      openCodeServer.url = server.url;
      if (server.headers) {
        openCodeServer.headers = server.headers;
      }
    } else {
      // Local server configuration
      if (server.command) {
        // Combine command and args into a single array
        const command = Array.isArray(server.command)
          ? server.command
          : [server.command];
        const args = server.args || [];
        openCodeServer.command = [...command, ...args];
      }

      if (server.env) {
        openCodeServer.environment = server.env;
      }
    }

    openCodeServers[name] = openCodeServer;
  }

  return {
    $schema: 'https://opencode.ai/config.json',
    mcp: openCodeServers,
  };
}

export async function propagateMcpToOpenCode(
  rulerMcpPath: string,
  openCodeConfigPath: string,
): Promise<void> {
  let rulerMcp;
  try {
    const rulerJsonContent = await fs.readFile(rulerMcpPath, 'utf8');
    rulerMcp = JSON.parse(rulerJsonContent);
  } catch {
    return;
  }

  // Read existing OpenCode config if it exists
  let existingConfig: any = {};
  try {
    const existingContent = await fs.readFile(openCodeConfigPath, 'utf8');
    existingConfig = JSON.parse(existingContent);
  } catch {
    // File doesn't exist, we'll create it
  }

  // Transform ruler MCP to OpenCode format
  const transformedConfig = transformToOpenCodeFormat(rulerMcp);

  // Merge with existing config, preserving non-MCP settings
  const finalConfig = {
    ...existingConfig,
    $schema: transformedConfig.$schema,
    mcp: {
      ...existingConfig.mcp,
      ...transformedConfig.mcp,
    },
  };

  await ensureDirExists(path.dirname(openCodeConfigPath));
  await fs.writeFile(
    openCodeConfigPath,
    JSON.stringify(finalConfig, null, 2) + '\n',
  );
}
