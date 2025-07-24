import { promises as fs } from 'fs';
import * as path from 'path';
import { McpStrategy } from '../types';

/**
 * VSCode settings.json structure for Augment MCP configuration
 */
export interface VSCodeSettings {
  'augment.advanced'?: {
    mcpServers?: AugmentMcpServer[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Augment MCP server configuration format
 */
export interface AugmentMcpServer {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * Read VSCode settings.json file
 */
export async function readVSCodeSettings(
  settingsPath: string,
): Promise<VSCodeSettings> {
  try {
    const content = await fs.readFile(settingsPath, 'utf8');
    return JSON.parse(content) as VSCodeSettings;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

/**
 * Write VSCode settings.json file
 */
export async function writeVSCodeSettings(
  settingsPath: string,
  settings: VSCodeSettings,
): Promise<void> {
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 4));
}

/**
 * Transform ruler MCP config to Augment MCP server array format
 */
export function transformRulerToAugmentMcp(
  rulerMcpJson: Record<string, unknown>,
): AugmentMcpServer[] {
  const servers: AugmentMcpServer[] = [];

  if (rulerMcpJson.mcpServers && typeof rulerMcpJson.mcpServers === 'object') {
    const mcpServers = rulerMcpJson.mcpServers as Record<
      string,
      {
        command: string;
        args?: string[];
        env?: Record<string, string>;
      }
    >;

    for (const [name, serverConfig] of Object.entries(mcpServers)) {
      const augmentServer: AugmentMcpServer = {
        name,
        command: serverConfig.command,
      };

      if (serverConfig.args) {
        augmentServer.args = serverConfig.args;
      }

      if (serverConfig.env) {
        augmentServer.env = serverConfig.env;
      }

      servers.push(augmentServer);
    }
  }

  return servers;
}

/**
 * Merge MCP servers into VSCode settings using the specified strategy
 */
export function mergeAugmentMcpServers(
  existingSettings: VSCodeSettings,
  newServers: AugmentMcpServer[],
  strategy: McpStrategy,
): VSCodeSettings {
  const result = structuredClone(existingSettings);

  if (!result['augment.advanced']) {
    result['augment.advanced'] = {};
  }

  if (strategy === 'overwrite') {
    result['augment.advanced'].mcpServers = newServers;
  } else {
    const existingServers = result['augment.advanced'].mcpServers || [];
    const existingServerMap = new Map<string, AugmentMcpServer>();

    for (const server of existingServers) {
      existingServerMap.set(server.name, server);
    }

    for (const newServer of newServers) {
      existingServerMap.set(newServer.name, newServer);
    }

    result['augment.advanced'].mcpServers = Array.from(
      existingServerMap.values(),
    );
  }

  return result;
}

/**
 * Get the VSCode settings.json path for a project (local)
 */
export function getVSCodeSettingsPath(projectRoot: string): string {
  return path.join(projectRoot, '.vscode', 'settings.json');
}
