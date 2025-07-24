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
    await backupFile(instructionsPath);
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
      let updatedConfig: Record<string, any> = { ...existingConfig };
      
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
        updatedConfig.mcp_servers[serverName] = serverConfig;
      }

      // Convert to TOML and write to file
      const tomlContent = stringify(updatedConfig);
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
