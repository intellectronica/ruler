import { IAgent, IAgentConfig } from './IAgent';
import * as fs from 'fs/promises';
import * as path from 'path';

export class OpenCodeAgent implements IAgent {
  getIdentifier(): string {
    return 'opencode';
  }

  getName(): string {
    return 'OpenCode';
  }

  getDefaultOutputPath(projectRoot: string): Record<string, string> {
    return {
      instructions: path.join(projectRoot, 'AGENTS.md'),
      mcp: path.join(projectRoot, 'opencode.json'),
    };
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: Record<string, unknown> | null,
    agentConfig?: IAgentConfig,
  ): Promise<void> {
    const outputPaths = this.getDefaultOutputPath(projectRoot);
    const instructionsPath = path.resolve(
      projectRoot,
      agentConfig?.outputPathInstructions ?? outputPaths['instructions'],
    );
    const mcpPath = path.resolve(
      projectRoot,
      agentConfig?.outputPathConfig ?? outputPaths['mcp'],
    );

    await fs.writeFile(instructionsPath, concatenatedRules);

    // Create OpenCode config with schema and MCP configuration
    let finalMcpConfig: { $schema: string; mcp: Record<string, unknown> } = {
      $schema: 'https://opencode.ai/config.json',
      mcp: {},
    };

    try {
      const existingMcpConfig = JSON.parse(await fs.readFile(mcpPath, 'utf-8'));
      if (existingMcpConfig && typeof existingMcpConfig === 'object') {
        finalMcpConfig = {
          $schema: 'https://opencode.ai/config.json',
          ...existingMcpConfig,
          mcp: {
            ...(existingMcpConfig.mcp || {}),
            ...((rulerMcpJson?.mcpServers ?? {}) as Record<string, unknown>),
          },
        };
      } else if (rulerMcpJson) {
        finalMcpConfig = {
          $schema: 'https://opencode.ai/config.json',
          mcp: (rulerMcpJson?.mcpServers ?? {}) as Record<string, unknown>,
        };
      }
    } catch {
      if (rulerMcpJson) {
        finalMcpConfig = {
          $schema: 'https://opencode.ai/config.json',
          mcp: (rulerMcpJson?.mcpServers ?? {}) as Record<string, unknown>,
        };
      }
    }

    // Always write the config file, even if MCP is empty
    await fs.writeFile(mcpPath, JSON.stringify(finalMcpConfig, null, 2));
  }

  supportsMcpStdio(): boolean {
    return true;
  }

  supportsMcpRemote(): boolean {
    return true;
  }
}
