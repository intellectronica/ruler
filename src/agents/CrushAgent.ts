import { IAgent, IAgentConfig } from './IAgent';
import * as fs from 'fs/promises';
import * as path from 'path';

export class CrushAgent implements IAgent {
  getIdentifier(): string {
    return 'crush';
  }

  getName(): string {
    return 'Crush';
  }

  getDefaultOutputPath(projectRoot: string): Record<string, string> {
    return {
      instructions: path.join(projectRoot, 'CRUSH.md'),
      mcp: path.join(projectRoot, '.crush.json'),
    };
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: Record<string, unknown> | null,
    agentConfig?: IAgentConfig,
  ): Promise<void> {
    const outputPaths = this.getDefaultOutputPath(projectRoot);
    const instructionsPath =
      agentConfig?.outputPathInstructions ?? outputPaths['instructions'];
    const mcpPath = agentConfig?.outputPathConfig ?? outputPaths['mcp'];

    await fs.writeFile(instructionsPath, concatenatedRules);

    // Always transform from mcpServers ({ mcpServers: ... }) to { mcp: ... } for Crush
    let finalMcpConfig: { mcp: Record<string, unknown> } = { mcp: {} };

    try {
      const existingMcpConfig = JSON.parse(await fs.readFile(mcpPath, 'utf-8'));
      if (existingMcpConfig && typeof existingMcpConfig === 'object') {
        finalMcpConfig = {
          ...existingMcpConfig,
          mcp: {
            ...(existingMcpConfig.mcp || {}),
            ...((rulerMcpJson?.mcpServers as Record<string, unknown>) || {}),
          },
        };
      } else if (rulerMcpJson) {
        finalMcpConfig = {
          mcp: (rulerMcpJson?.mcpServers ?? {}) as Record<string, unknown>,
        };
      }
    } catch {
      if (rulerMcpJson) {
        finalMcpConfig = {
          mcp: (rulerMcpJson?.mcpServers ?? {}) as Record<string, unknown>,
        };
      }
    }

    if (Object.keys(finalMcpConfig.mcp).length > 0) {
      await fs.writeFile(mcpPath, JSON.stringify(finalMcpConfig, null, 2));
    }
  }
}
