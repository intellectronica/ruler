import * as fs from 'fs/promises';
import { parse as parseTOML, stringify } from '@iarna/toml';
import { ensureDirExists, writeGeneratedFile } from '../core/FileSystemUtils';
import * as path from 'path';
import { McpStrategy } from '../types';

interface StdioServer {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface RemoteServerEntry {
  url: string;
  api_key?: string;
}

interface RulerMcpServer {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

function isRulerMcpServer(value: unknown): value is RulerMcpServer {
  const server = value as RulerMcpServer;
  return (
    server &&
    (typeof server.command === 'string' || typeof server.url === 'string')
  );
}

function classifyRemoteServer(url: string): 'sse' | 'shttp' {
  // Heuristic: URLs containing /sse path segments are classified as SSE
  return /\/sse(\/|$)/i.test(url) ? 'sse' : 'shttp';
}

function extractApiKey(headers?: Record<string, string>): string | null {
  if (!headers) return null;

  const authHeader = headers.Authorization || headers.authorization;
  if (!authHeader) return null;

  // Extract Bearer token if that's the only header, or if only Authorization + standard content headers
  const headerCount = Object.keys(headers).length;
  const hasOnlyAuthHeader = headerCount === 1;
  const hasOnlyStandardHeaders =
    headerCount <= 2 &&
    (headers['Content-Type'] ||
      headers['content-type'] ||
      headers['Accept'] ||
      headers['accept']);

  if (
    (hasOnlyAuthHeader || hasOnlyStandardHeaders) &&
    authHeader.startsWith('Bearer ')
  ) {
    return authHeader.substring('Bearer '.length);
  }

  return null;
}

function createRemoteServerEntry(
  name: string,
  url: string,
  headers?: Record<string, string>,
): string | RemoteServerEntry {
  const hasHeaders = headers && Object.keys(headers).length > 0;
  const apiKey = extractApiKey(headers);

  if (hasHeaders) {
    if (apiKey) {
      return { url, api_key: apiKey };
    }

    throw new Error(
      `OpenHands MCP remote server "${name}" has unsupported headers. OpenHands config.toml can only represent a Bearer Authorization header as api_key.`,
    );
  }

  return url;
}

function normalizeRemoteServerArray(
  entries: (string | RemoteServerEntry)[],
): (string | RemoteServerEntry)[] {
  // TOML doesn't support mixed types in arrays, so we need to be consistent
  // If any entry is an object, convert all simple URLs to objects
  const hasObjectEntries = entries.some((entry) => typeof entry === 'object');

  if (hasObjectEntries) {
    return entries.map((entry) => {
      if (typeof entry === 'string') {
        return { url: entry };
      }
      return entry;
    });
  }

  // All entries are strings, keep as is
  return entries;
}

export async function propagateMcpToOpenHands(
  rulerMcpData: Record<string, unknown> | null,
  openHandsConfigPath: string,
  backup = true,
  strategy: McpStrategy = 'merge',
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
      sse_servers?: (string | RemoteServerEntry)[];
      shttp_servers?: (string | RemoteServerEntry)[];
    };
  } = {};
  let tomlContent: string | undefined;
  try {
    tomlContent = await fs.readFile(openHandsConfigPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new Error(
        `Could not read OpenHands config at ${openHandsConfigPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  if (tomlContent !== undefined) {
    try {
      config = parseTOML(tomlContent);
    } catch (error) {
      throw new Error(
        `Invalid OpenHands config at ${openHandsConfigPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (!config.mcp) {
    config.mcp = {};
  }
  if (!config.mcp.stdio_servers) {
    config.mcp.stdio_servers = [];
  }
  if (!config.mcp.sse_servers) {
    config.mcp.sse_servers = [];
  }
  if (!config.mcp.shttp_servers) {
    config.mcp.shttp_servers = [];
  }

  // Build maps for merging existing servers, or start fresh when overwriting.
  const existingStdioServers = new Map<string, StdioServer>(
    strategy === 'overwrite'
      ? []
      : config.mcp.stdio_servers.map((s: StdioServer) => [s.name, s]),
  );

  const existingSseServers = new Map<string, string | RemoteServerEntry>();
  if (strategy !== 'overwrite') {
    config.mcp.sse_servers.forEach((entry: string | RemoteServerEntry) => {
      const url = typeof entry === 'string' ? entry : entry.url;
      existingSseServers.set(url, entry);
    });
  }

  const existingShttpServers = new Map<string, string | RemoteServerEntry>();
  if (strategy !== 'overwrite') {
    config.mcp.shttp_servers.forEach((entry: string | RemoteServerEntry) => {
      const url = typeof entry === 'string' ? entry : entry.url;
      existingShttpServers.set(url, entry);
    });
  }

  for (const [name, serverDef] of Object.entries(rulerServers)) {
    if (isRulerMcpServer(serverDef)) {
      if (serverDef.command) {
        // Stdio server
        const { command, args, env } = serverDef;
        const newServer: StdioServer = { name, command };
        if (args) newServer.args = args;
        if (env) newServer.env = env;
        existingStdioServers.set(name, newServer);
      } else if (serverDef.url) {
        // Remote server
        const classification = classifyRemoteServer(serverDef.url);
        const entry = createRemoteServerEntry(
          name,
          serverDef.url,
          serverDef.headers,
        );

        if (classification === 'sse') {
          existingSseServers.set(serverDef.url, entry);
        } else {
          existingShttpServers.set(serverDef.url, entry);
        }
      }
    }
  }

  // Convert maps back to arrays and normalize for TOML compatibility
  config.mcp.stdio_servers = Array.from(existingStdioServers.values());
  config.mcp.sse_servers = normalizeRemoteServerArray(
    Array.from(existingSseServers.values()),
  );
  config.mcp.shttp_servers = normalizeRemoteServerArray(
    Array.from(existingShttpServers.values()),
  );
  const finalContent = stringify(config);

  if (tomlContent === finalContent) {
    return;
  }

  await ensureDirExists(path.dirname(openHandsConfigPath));
  if (backup) {
    const { backupFile } = await import('../core/FileSystemUtils');
    await backupFile(openHandsConfigPath);
  }
  await writeGeneratedFile(openHandsConfigPath, finalContent);
}
