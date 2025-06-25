import { IAgent, IAgentConfig } from './IAgent';
import * as path from 'path';
import { promises as fs } from 'fs';
import { mergeMcp } from '../mcp/merge';

export class GeminiCliAgent implements IAgent {
  getIdentifier(): string {
    return 'gemini-cli';
  }

  getName(): string {
    return 'Gemini CLI';
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: Record<string, unknown> | null,
    agentConfig?: IAgentConfig,
  ): Promise<void> {
    const outputPath = this.getDefaultOutputPath(projectRoot);
    await fs.writeFile(outputPath as string, concatenatedRules);

    if (rulerMcpJson) {
      const settingsPath = path.join(projectRoot, '.gemini', 'settings.json');
      let existingSettings: Record<string, unknown> = {};
      try {
        const existingSettingsRaw = await fs.readFile(settingsPath, 'utf8');
        existingSettings = JSON.parse(existingSettingsRaw);
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }

      const merged = mergeMcp(
        existingSettings,
        rulerMcpJson,
        agentConfig?.mcp?.strategy ?? 'merge',
        this.getMcpServerKey(),
      );

      await fs.mkdir(path.dirname(settingsPath), { recursive: true });
      await fs.writeFile(settingsPath, JSON.stringify(merged, null, 2));
    }
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, 'GEMINI.md');
  }

  getMcpServerKey(): string {
    return 'mcpServers';
  }
}
