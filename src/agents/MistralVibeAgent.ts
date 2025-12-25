import * as path from 'path';
import { promises as fs } from 'fs';
import { parse as parseTOML, stringify } from '@iarna/toml';
import { IAgent, IAgentConfig } from './IAgent';
import { AgentsMdAgent } from './AgentsMdAgent';
import { writeGeneratedFile } from '../core/FileSystemUtils';
import { DEFAULT_RULES_FILENAME } from '../constants';

/**
 * Mistral Vibe MCP server configuration using [[mcp_servers]] array format.
 */
interface VibeMcpServer {
  name: string;
  transport: 'stdio' | 'http' | 'streamable-http';
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  api_key_env?: string;
  api_key_header?: string;
  api_key_format?: string;
  env?: Record<string, string>;
}

interface VibeConfig {
  mcp_servers?: VibeMcpServer[];
  // Allow other properties to be preserved
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface RulerMcpServer {
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
}

interface RulerMcp {
  mcpServers?: Record<string, RulerMcpServer>;
}

/**
 * Mistral Vibe CLI agent adapter.
 * Propagates rules to AGENTS.md and MCP servers to .vibe/config.toml.
 */
export class MistralVibeAgent implements IAgent {
  private agentsMdAgent = new AgentsMdAgent();

  getIdentifier(): string {
    return 'mistral';
  }

  getName(): string {
    return 'Mistral';
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: RulerMcp | null,
    agentConfig?: IAgentConfig,
    backup = true,
  ): Promise<void> {
    // First perform idempotent AGENTS.md write via composed AgentsMdAgent
    await this.agentsMdAgent.applyRulerConfig(
      concatenatedRules,
      projectRoot,
      null,
      {
        outputPath:
          agentConfig?.outputPath ||
          agentConfig?.outputPathInstructions ||
          undefined,
      },
      backup,
    );

    // Handle MCP configuration
    const defaults = this.getDefaultOutputPath(projectRoot);
    const mcpEnabled = agentConfig?.mcp?.enabled ?? true;

    if (mcpEnabled && rulerMcpJson) {
      // Apply MCP server filtering and transformation
      const { filterMcpConfigForAgent } = await import('../mcp/capabilities');
      const filteredMcpConfig = filterMcpConfigForAgent(
        rulerMcpJson as Record<string, unknown>,
        this,
      );

      if (!filteredMcpConfig) {
        return; // No compatible servers found
      }

      const filteredRulerMcpJson = filteredMcpConfig as {
        mcpServers: Record<string, RulerMcpServer>;
      };

      // Determine the config file path
      const configPath = agentConfig?.outputPathConfig ?? defaults.config;

      // Ensure the parent directory exists
      await fs.mkdir(path.dirname(configPath), { recursive: true });

      // Get the merge strategy
      const strategy = agentConfig?.mcp?.strategy ?? 'merge';

      // Transform ruler MCP servers to Vibe format
      const rulerServers = filteredRulerMcpJson.mcpServers || {};
      const vibeServers: VibeMcpServer[] = [];

      for (const [serverName, serverConfig] of Object.entries(rulerServers)) {
        const vibeServer: VibeMcpServer = {
          name: serverName,
          transport: this.determineTransport(serverConfig),
        };

        // Handle stdio servers
        if (serverConfig.command) {
          vibeServer.command = serverConfig.command;
          if (serverConfig.args) {
            vibeServer.args = serverConfig.args;
          }
        }

        // Handle remote servers
        if (serverConfig.url) {
          vibeServer.url = serverConfig.url;
        }

        // Handle headers
        if (serverConfig.headers) {
          vibeServer.headers = serverConfig.headers;
        }

        // Handle env
        if (serverConfig.env) {
          vibeServer.env = serverConfig.env;
        }

        vibeServers.push(vibeServer);
      }

      // Read existing TOML config if it exists
      let existingConfig: VibeConfig = {};
      try {
        const existingContent = await fs.readFile(configPath, 'utf8');
        existingConfig = parseTOML(existingContent) as VibeConfig;
      } catch {
        // File doesn't exist or can't be parsed, use empty config
      }

      // Create the updated config
      const updatedConfig: VibeConfig = { ...existingConfig };

      if (strategy === 'overwrite') {
        // For overwrite strategy, replace the entire mcp_servers array
        updatedConfig.mcp_servers = vibeServers;
      } else {
        // For merge strategy, merge by server name
        const existingServers = updatedConfig.mcp_servers || [];

        // Keep existing servers that aren't being overwritten by ruler
        const mergedServers = existingServers.filter(
          (s) => !rulerServers[s.name],
        );

        // Add all ruler servers
        mergedServers.push(...vibeServers);

        updatedConfig.mcp_servers = mergedServers;
      }

      // Convert to TOML and write
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tomlContent = stringify(updatedConfig as any);
      await writeGeneratedFile(configPath, tomlContent);
    }
  }

  /**
   * Determines the transport type based on server configuration.
   */
  private determineTransport(
    server: RulerMcpServer,
  ): 'stdio' | 'http' | 'streamable-http' {
    if (server.command) {
      return 'stdio';
    }
    if (server.url) {
      // Default to http for remote servers
      // Could potentially detect streamable-http based on URL patterns if needed
      return 'http';
    }
    return 'stdio';
  }

  getDefaultOutputPath(projectRoot: string): Record<string, string> {
    return {
      instructions: path.join(projectRoot, DEFAULT_RULES_FILENAME),
      config: path.join(projectRoot, '.vibe', 'config.toml'),
    };
  }

  supportsMcpStdio(): boolean {
    return true;
  }

  supportsMcpRemote(): boolean {
    return true; // Mistral Vibe supports http and streamable-http transports
  }

  supportsNativeSkills(): boolean {
    // Mistral Vibe uses ~/.vibe/tools/ for custom tools globally
    // It doesn't have project-local native skills support
    return false;
  }
}
