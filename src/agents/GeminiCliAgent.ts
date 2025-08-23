import { IAgentConfig } from './IAgent';
import * as path from 'path';
import { promises as fs } from 'fs';
import { AgentsMdAgent } from './AgentsMdAgent';

export class GeminiCliAgent extends AgentsMdAgent {
  getIdentifier(): string {
    return 'gemini-cli';
  }

  getName(): string {
    return 'Gemini CLI';
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: Record<string, unknown> | null, // eslint-disable-line @typescript-eslint/no-unused-vars
    agentConfig?: IAgentConfig,
  ): Promise<void> {
    // First, perform idempotent write of AGENTS.md via base class
    await super.applyRulerConfig(concatenatedRules, projectRoot, null, {
      outputPath: agentConfig?.outputPath,
    });

    // Ensure .gemini/settings.json has contextFileName set to AGENTS.md
    const settingsPath = path.join(projectRoot, '.gemini', 'settings.json');
    let existingSettings: Record<string, unknown> = {};
    try {
      const raw = await fs.readFile(settingsPath, 'utf8');
      existingSettings = JSON.parse(raw);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }

    const updated = {
      ...existingSettings,
      contextFileName: 'AGENTS.md',
    } as Record<string, unknown>;

    await fs.mkdir(path.dirname(settingsPath), { recursive: true });
    await fs.writeFile(settingsPath, JSON.stringify(updated, null, 2));
  }
}
