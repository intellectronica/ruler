import { IAgentConfig } from './IAgent';
import * as path from 'path';
import { promises as fs } from 'fs';
import { AgentsMdAgent } from './AgentsMdAgent';
import {
  backupFile,
  writeGeneratedFile,
  writeGeneratedProvenance,
} from '../core/FileSystemUtils';

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

  private getSettingsPath(projectRoot: string, agentConfig?: IAgentConfig) {
    return path.resolve(
      projectRoot,
      agentConfig?.outputPathConfig ?? path.join('.qwen', 'settings.json'),
    );
  }

  getAdditionalOutputPaths(
    projectRoot: string,
    agentConfig?: IAgentConfig,
  ): string[] {
    return [this.getSettingsPath(projectRoot, agentConfig)];
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
    const settingsPath = this.getSettingsPath(projectRoot, agentConfig);
    let existingSettings: Record<string, unknown> = {};
    let existingContent: string | null = null;
    try {
      const raw = await fs.readFile(settingsPath, 'utf8');
      existingContent = raw;
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

    const nextContent = JSON.stringify(updated, null, 2);
    if (existingContent === nextContent) {
      return;
    }

    if (backup && existingContent !== null) {
      await backupFile(settingsPath, projectRoot);
    }

    await writeGeneratedFile(settingsPath, nextContent, projectRoot);
    if (existingContent === null) {
      await writeGeneratedProvenance(
        settingsPath,
        projectRoot,
        'Qwen settings',
      );
    }
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
