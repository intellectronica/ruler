import { IAgent, IAgentConfig } from './IAgent';
import { backupFile, writeGeneratedFile } from '../core/FileSystemUtils';
import * as path from 'path';

export class OpenCodeAgent implements IAgent {
  getIdentifier(): string {
    return 'opencode';
  }

  getName(): string {
    return 'OpenCode';
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    rulerMcpJson: Record<string, unknown> | null, // eslint-disable-line @typescript-eslint/no-unused-vars
    agentConfig?: IAgentConfig,
  ): Promise<void> {
    const outputPath =
      agentConfig?.outputPath ?? this.getDefaultOutputPath(projectRoot);
    const absolutePath = path.resolve(projectRoot, outputPath);
    await backupFile(absolutePath, agentConfig?.disableBackup);
    await writeGeneratedFile(absolutePath, concatenatedRules);
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, 'AGENTS.md');
  }

  getMcpServerKey(): string {
    return 'mcp';
  }
}
