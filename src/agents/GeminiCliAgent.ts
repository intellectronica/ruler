import { IAgent, IAgentConfig } from './IAgent';
import * as path from 'path';
import { promises as fs } from 'fs';

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
    agentConfig?: IAgentConfig, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<void> {
    const outputPath = this.getDefaultOutputPath(projectRoot);
    await fs.writeFile(outputPath as string, concatenatedRules);
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, 'GEMINI.md');
  }

  getMcpServerKey(): string {
    return 'mcpServers';
  }
}
