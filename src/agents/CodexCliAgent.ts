import * as path from 'path';
import { promises as fs } from 'fs';
import * as toml from 'toml';
import { stringify } from '@iarna/toml';
import { IAgentConfig } from './IAgent';
import { AgentsMdAgent } from './AgentsMdAgent';
import { writeGeneratedFile } from '../core/FileSystemUtils';
import { DEFAULT_RULES_FILENAME } from '../constants';

interface McpServer {
  command: string;
  args?: string[];
  env?: Record<string, string>;
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
export class CodexCliAgent extends AgentsMdAgent {
  getIdentifier(): string {
    return 'codex';
  }

  getName(): string {
    return 'OpenAI Codex CLI';
  }

  supportsLocalMcp(): boolean {
    return true;
  }

  supportsRemoteMcp(): boolean {
    return false; // Codex supports only STDIO MCP servers
  }

  supportsMcp(): boolean {
    return true; // Override AgentsMdAgent's false default
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: RulerMcp | null,
    agentConfig?: IAgentConfig,
  ): Promise<void> {
    // First perform idempotent AGENTS.md write via base class (instructions file).
    await super.applyRulerConfig(concatenatedRules, projectRoot, null, {
      // Preserve explicit outputPath precedence semantics if provided.
      outputPath:
        agentConfig?.outputPath ||
        agentConfig?.outputPathInstructions ||
        undefined,
    });
    // Resolve config path helper (mirrors previous logic)
    const defaults = {
      instructions: path.join(projectRoot, DEFAULT_RULES_FILENAME),
      config: path.join(projectRoot, '.codex', 'config.toml'),
    };
    const mcpEnabled = agentConfig?.mcp?.enabled ?? true;
    if (mcpEnabled && rulerMcpJson) {
      // Determine the config file path
      const configPath = agentConfig?.outputPathConfig ?? defaults.config;

      // Ensure the parent directory exists
      await fs.mkdir(path.dirname(configPath), { recursive: true });

      // Get the merge strategy
      const strategy = agentConfig?.mcp?.strategy ?? 'merge';

      // Extract MCP servers from ruler config
      const rulerServers = rulerMcpJson.mcpServers || {};

      // Read existing TOML config if it exists
      let existingConfig: CodexCliConfig = {};
      try {
        const existingContent = await fs.readFile(configPath, 'utf8');
        existingConfig = toml.parse(existingContent);
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

        if (updatedConfig.mcp_servers) {
          updatedConfig.mcp_servers[serverName] = mcpServer;
        }
      }

      // Convert to TOML with special handling for env to ensure it's an inline table
      let tomlContent = '';

      // Handle non-mcp_servers sections first
      const configWithoutMcpServers: Omit<CodexCliConfig, 'mcp_servers'> &
        Record<string, unknown> = { ...updatedConfig };
      delete configWithoutMcpServers.mcp_servers;
      if (Object.keys(configWithoutMcpServers).length > 0) {
        tomlContent += stringify(configWithoutMcpServers);
      }

      // Now handle mcp_servers with special formatting for env
      if (
        updatedConfig.mcp_servers &&
        Object.keys(updatedConfig.mcp_servers).length > 0
      ) {
        for (const [serverName, serverConfig] of Object.entries(
          updatedConfig.mcp_servers,
        )) {
          tomlContent += `\n[mcp_servers.${serverName}]\n`;

          // Add command
          if (serverConfig.command) {
            tomlContent += `command = "${serverConfig.command}"\n`;
          }

          // Add args if present
          if (serverConfig.args && Array.isArray(serverConfig.args)) {
            const argsStr = JSON.stringify(serverConfig.args)
              .replace(/"/g, '"')
              .replace(/,/g, ', ');
            tomlContent += `args = ${argsStr}\n`;
          }

          // Add env as inline table if present
          if (serverConfig.env && Object.keys(serverConfig.env).length > 0) {
            tomlContent += `env = { `;
            const entries = Object.entries(serverConfig.env);
            for (let i = 0; i < entries.length; i++) {
              const [key, value] = entries[i];
              tomlContent += `${key} = "${value}"`;
              if (i < entries.length - 1) {
                tomlContent += ', ';
              }
            }
            tomlContent += ` }\n`;
          }
        }
      }

      await writeGeneratedFile(configPath, tomlContent);
    }
  }
}
