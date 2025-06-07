import * as path from 'path';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { promises as fs } from 'fs';
import toml from 'toml';
import { stringify } from '@iarna/toml';
import { mergeMcp } from '../mcp/merge';
import { IAgent, IAgentConfig } from './IAgent';
import { backupFile, writeGeneratedFile } from '../core/FileSystemUtils';

/**
 * OpenAI Codex CLI agent adapter (stub implementation).
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
    agentConfig?: IAgentConfig,
  ): Promise<void> {
    const defaults = this.getDefaultOutputPath(projectRoot);
    const instructionsPath =
      agentConfig?.outputPath ??
      agentConfig?.outputPathInstructions ??
      defaults.instructions;
    await backupFile(instructionsPath);
    await writeGeneratedFile(instructionsPath, concatenatedRules);

    const mcpEnabled = agentConfig?.mcp?.enabled ?? true;
    if (mcpEnabled) {
      const configPath = agentConfig?.outputPathConfig ?? defaults.config;
      // Read ruler MCP definitions
      const rulerMcpPath = path.join(projectRoot, '.ruler', 'mcp.json');
      let rulerMcp: Record<string, any> = {};
      try {
        const raw = await fs.readFile(rulerMcpPath, 'utf8');
        rulerMcp = JSON.parse(raw) as Record<string, any>;
      } catch {
        rulerMcp = {};
      }
      // Read existing TOML config
      let nativeConfig: Record<string, any> = {};
      try {
        const raw = await fs.readFile(configPath, 'utf8');
        nativeConfig = toml.parse(raw) as Record<string, any>;
      } catch {
        nativeConfig = {};
      }
      const existing = (nativeConfig.mcp_servers as Record<string, any>) || {};
      const incoming = (rulerMcp.mcpServers as Record<string, any>) || {};
      const strategy = agentConfig?.mcp?.strategy ?? 'merge';
      const merged = mergeMcp(
        { mcpServers: existing },
        { mcpServers: incoming },
        strategy,
      );
      const updatedConfig = {
        ...nativeConfig,
        mcp_servers: merged.mcpServers,
      };
      const tomlStr = stringify(updatedConfig);
      await writeGeneratedFile(configPath, tomlStr);
    }
  }
  getDefaultOutputPath(projectRoot: string): Record<string, string> {
    return {
      instructions: path.join(projectRoot, 'AGENTS.md'),
      config: path.join(projectRoot, '.codex', 'config.toml'),
    };
  }
}
