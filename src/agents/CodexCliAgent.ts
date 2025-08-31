import * as path from 'path';
import { promises as fs } from 'fs';
import { parse as parseTOML, stringify } from '@iarna/toml';
import { IAgent, IAgentConfig } from './IAgent';
import { AgentsMdAgent } from './AgentsMdAgent';
import { writeGeneratedFile } from '../core/FileSystemUtils';
import { DEFAULT_RULES_FILENAME } from '../constants';

interface McpServer {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>; // Support headers from transformed remote servers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // Allow additional properties from transformation
}

interface CodexCliConfig {
  mcp_servers?: Record<string, McpServer>;
}

interface RulerMcp {
  mcpServers?: Record<string, McpServer>;
}

/**
 * OpenAI Codex CLI agent adapter.
 */
export class CodexCliAgent implements IAgent {
  private agentsMdAgent = new AgentsMdAgent();

  getIdentifier(): string {
    return 'codex';
  }

  getName(): string {
    return 'OpenAI Codex CLI';
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
        // Preserve explicit outputPath precedence semantics if provided.
        outputPath:
          agentConfig?.outputPath ||
          agentConfig?.outputPathInstructions ||
          undefined,
      },
      backup,
    );
    // Use proper path resolution from getDefaultOutputPath and agentConfig
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
        mcpServers: Record<string, McpServer>;
      };

      // Determine the config file path using proper precedence
      const configPath = agentConfig?.outputPathConfig ?? defaults.config;

      // Ensure the parent directory exists
      await fs.mkdir(path.dirname(configPath), { recursive: true });

      // Get the merge strategy
      const strategy = agentConfig?.mcp?.strategy ?? 'merge';

      // Extract MCP servers from filtered ruler config
      const rulerServers = filteredRulerMcpJson.mcpServers || {};

      // Read existing TOML config if it exists
      let existingConfig: CodexCliConfig = {};
      try {
        const existingContent = await fs.readFile(configPath, 'utf8');
        existingConfig = parseTOML(existingContent);
      } catch {
        // File doesn't exist or can't be parsed, use empty config
      }

      // Create the updated config
      const updatedConfig: CodexCliConfig = { ...existingConfig };

      // Initialize mcp_servers if it doesn't exist
      if (!updatedConfig.mcp_servers) {
        updatedConfig.mcp_servers = {};
      }

      if (strategy === 'overwrite') {
        // For overwrite strategy, replace the entire mcp_servers section
        updatedConfig.mcp_servers = {};
      }

      // Add the ruler servers
      for (const [serverName, serverConfig] of Object.entries(rulerServers)) {
        // Create a properly formatted MCP server entry
        const mcpServer: McpServer = {
          command: serverConfig.command,
        };
        if (serverConfig.args) {
          mcpServer.args = serverConfig.args;
        }
        // Format env as an inline table
        if (serverConfig.env) {
          mcpServer.env = serverConfig.env;
        }
        // Handle additional properties from remote server transformation
        if (serverConfig.headers) {
          mcpServer.headers = serverConfig.headers;
        }

        if (updatedConfig.mcp_servers) {
          updatedConfig.mcp_servers[serverName] = mcpServer;
        }
      }

      // Convert to TOML using structured objects
      const finalConfig = { ...updatedConfig };

      // @iarna/toml should handle the formatting properly
      const tomlContent = stringify(finalConfig);

      await writeGeneratedFile(configPath, tomlContent);
    }
  }

  getDefaultOutputPath(projectRoot: string): Record<string, string> {
    return {
      instructions: path.join(projectRoot, DEFAULT_RULES_FILENAME),
      config: path.join(projectRoot, '.codex', 'config.toml'),
    };
  }

  supportsMcpStdio(): boolean {
    return true;
  }

  supportsMcpRemote(): boolean {
    return false; // Codex CLI only supports STDIO based on PR description
  }
}
