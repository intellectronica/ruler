import * as path from 'path';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { promises as fs } from 'fs';
import * as toml from 'toml';
import { stringify } from '@iarna/toml';
import { IAgent, IAgentConfig } from './IAgent';
import { backupFile, writeGeneratedFile } from '../core/FileSystemUtils';

/**
 * OpenAI Codex CLI agent adapter.
 */
export class CodexCliAgent implements IAgent {
  getIdentifier(): string {
    return 'codex';
  }

  getName(): string {
    return 'OpenAI Codex CLI';
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: Record<string, unknown> | null,
    agentConfig?: IAgentConfig,
  ): Promise<void> {
    // Get default paths
    const defaults = this.getDefaultOutputPath(projectRoot);

    // Determine the instructions file path
    const instructionsPath =
      agentConfig?.outputPath ??
      agentConfig?.outputPathInstructions ??
      defaults.instructions;

    // Write the instructions file
    if (!agentConfig?.disableBackup) {
      await backupFile(instructionsPath);
    }
    await writeGeneratedFile(instructionsPath, concatenatedRules);

    // Handle MCP configuration if enabled
    const mcpEnabled = agentConfig?.mcp?.enabled ?? true;
    if (mcpEnabled && rulerMcpJson) {
      // Determine the config file path
      const configPath = agentConfig?.outputPathConfig ?? defaults.config;

      // Ensure the parent directory exists
      await fs.mkdir(path.dirname(configPath), { recursive: true });

      // Get the merge strategy
      const strategy = agentConfig?.mcp?.strategy ?? 'merge';

      // Extract MCP servers from ruler config
      const rulerServers =
        (rulerMcpJson.mcpServers as Record<string, any>) || {};

      // Read existing TOML config if it exists
      let existingConfig: Record<string, any> = {};
      try {
        const existingContent = await fs.readFile(configPath, 'utf8');
        existingConfig = toml.parse(existingContent);
      } catch {
        // File doesn't exist or can't be parsed, use empty config
      }

      // Create the updated config
      const updatedConfig: Record<string, any> = { ...existingConfig };

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
        const mcpServer: Record<string, any> = {
          command: serverConfig.command,
          args: serverConfig.args,
        };

        // Format env as an inline table
        if (serverConfig.env) {
          mcpServer.env = serverConfig.env;
        }

        updatedConfig.mcp_servers[serverName] = mcpServer;
      }

      // Convert to TOML with special handling for env to ensure it's an inline table
      let tomlContent = '';

      // Handle non-mcp_servers sections first
      const configWithoutMcpServers = { ...updatedConfig };
      delete configWithoutMcpServers.mcp_servers;
      if (Object.keys(configWithoutMcpServers).length > 0) {
        tomlContent += stringify(configWithoutMcpServers);
      }

      // Now handle mcp_servers with special formatting for env
      if (
        updatedConfig.mcp_servers &&
        Object.keys(updatedConfig.mcp_servers).length > 0
      ) {
        for (const [serverName, serverConfigRaw] of Object.entries(
          updatedConfig.mcp_servers,
        )) {
          const serverConfig = serverConfigRaw as Record<string, any>;
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

  getDefaultOutputPath(projectRoot: string): Record<string, string> {
    return {
      instructions: path.join(projectRoot, 'AGENTS.md'),
      config: path.join(projectRoot, '.codex', 'config.toml'),
    };
  }
}
