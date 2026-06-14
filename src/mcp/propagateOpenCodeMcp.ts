import * as fs from 'fs/promises';
import { ensureDirExists, writeGeneratedFile } from '../core/FileSystemUtils';
import * as path from 'path';
import { McpStrategy } from '../types';

interface OpenCodeMcpServer {
  type: 'local' | 'remote';
  command?: string[];
  url?: string;
  enabled: boolean;
  environment?: Record<string, string>;
  headers?: Record<string, string>;
  timeout?: number;
}

interface OpenCodeConfig {
  $schema: string;
  mcp: Record<string, OpenCodeMcpServer>;
}

interface LocalServer {
  command: string | string[];
  args?: string[];
  env?: Record<string, string>;
  timeout?: number;
}

interface RemoteServer {
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
}

function isLocalServer(value: unknown): value is LocalServer {
  const server = value as LocalServer;
  return (
    server &&
    (typeof server.command === 'string' || Array.isArray(server.command))
  );
}

function isRemoteServer(value: unknown): value is RemoteServer {
  const server = value as RemoteServer;
  return server && typeof server.url === 'string';
}

interface RulerMcp {
  mcpServers?: Record<string, unknown>;
}

/**
 * Transform ruler MCP configuration to OpenCode's specific format
 */
function transformToOpenCodeFormat(rulerMcp: RulerMcp): OpenCodeConfig {
  const rulerServers = rulerMcp.mcpServers || {};
  const openCodeServers: Record<string, OpenCodeMcpServer> = {};

  for (const [name, serverDef] of Object.entries(rulerServers)) {
    const openCodeServer: OpenCodeMcpServer = {
      type: 'local',
      enabled: true,
    };

    if (isRemoteServer(serverDef)) {
      openCodeServer.type = 'remote';
      openCodeServer.url = serverDef.url;
      if (serverDef.headers) {
        openCodeServer.headers = serverDef.headers;
      }
      if (typeof serverDef.timeout === 'number') {
        openCodeServer.timeout = serverDef.timeout;
      }
    } else if (isLocalServer(serverDef)) {
      openCodeServer.type = 'local';
      const command = Array.isArray(serverDef.command)
        ? serverDef.command
        : [serverDef.command];
      const args = serverDef.args || [];
      openCodeServer.command = [...command, ...args];

      if (serverDef.env) {
        openCodeServer.environment = serverDef.env;
      }
      if (typeof serverDef.timeout === 'number') {
        openCodeServer.timeout = serverDef.timeout;
      }
    } else {
      continue;
    }

    openCodeServers[name] = openCodeServer;
  }

  return {
    $schema: 'https://opencode.ai/config.json',
    mcp: openCodeServers,
  };
}

export async function propagateMcpToOpenCode(
  rulerMcpData: Record<string, unknown> | null,
  openCodeConfigPath: string,
  backup = true,
  strategy: McpStrategy = 'merge',
): Promise<void> {
  const rulerMcp: RulerMcp = rulerMcpData || {};

  // Read existing OpenCode config if it exists
  let existingConfig: Partial<OpenCodeConfig> & Record<string, unknown> = {};
  let existingContent: string | undefined;
  try {
    existingContent = await fs.readFile(openCodeConfigPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new Error(
        `Could not read OpenCode config at ${openCodeConfigPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  if (existingContent !== undefined) {
    try {
      existingConfig = JSON.parse(existingContent);
    } catch (error) {
      throw new Error(
        `Invalid OpenCode config at ${openCodeConfigPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Transform ruler MCP to OpenCode format
  const transformedConfig = transformToOpenCodeFormat(rulerMcp);

  // Merge with existing config, preserving non-MCP settings
  const finalConfig = {
    ...existingConfig,
    $schema: transformedConfig.$schema,
    mcp:
      strategy === 'overwrite'
        ? transformedConfig.mcp
        : {
            ...existingConfig.mcp,
            ...transformedConfig.mcp,
          },
  };
  const finalContent = JSON.stringify(finalConfig, null, 2) + '\n';

  if (existingContent === finalContent) {
    return;
  }

  await ensureDirExists(path.dirname(openCodeConfigPath));
  if (backup) {
    const { backupFile } = await import('../core/FileSystemUtils');
    await backupFile(openCodeConfigPath);
  }
  await writeGeneratedFile(openCodeConfigPath, finalContent);
}
