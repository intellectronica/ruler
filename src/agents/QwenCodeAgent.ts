import { IAgentConfig } from './IAgent';
import * as path from 'path';
import { promises as fs } from 'fs';
import { AgentsMdAgent } from './AgentsMdAgent';
import { writeGeneratedFile } from '../core/FileSystemUtils';

export class QwenCodeAgent extends AgentsMdAgent {
  getIdentifier(): string {
    return 'qwen';
  }

  getName(): string {
    return 'Qwen Code';
  }

  private getContextFileName(projectRoot: string, agentConfig?: IAgentConfig) {
    const outputPath = agentConfig?.outputPath ?? 'AGENTS.md';
    return path
      .relative(projectRoot, path.resolve(projectRoot, outputPath))
      .replace(/\\/g, '/');
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    _rulerMcpJson: Record<string, unknown> | null,
    agentConfig?: IAgentConfig,
    backup = true,
  ): Promise<void> {
    // First, perform idempotent write of AGENTS.md via base class
    await super.applyRulerConfig(
      concatenatedRules,
      projectRoot,
      null,
      {
        outputPath: agentConfig?.outputPath,
      },
      backup,
    );

    // Ensure .qwen/settings.json has contextFileName set to AGENTS.md
    const settingsPath = path.join(projectRoot, '.qwen', 'settings.json');
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
      contextFileName: this.getContextFileName(projectRoot, agentConfig),
    } as Record<string, unknown>;

    await writeGeneratedFile(settingsPath, JSON.stringify(updated, null, 2));
  }

  // Ensure MCP merging uses the correct key for Qwen Code (.qwen/settings.json)
  getMcpServerKey(): string {
    return 'mcpServers';
  }

  supportsMcpStdio(): boolean {
    return true;
  }

  supportsMcpRemote(): boolean {
    return true;
  }
}
