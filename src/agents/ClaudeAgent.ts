import * as path from 'path';
import { IAgent, IAgentConfig } from './IAgent';
import { backupFile, writeGeneratedFile } from '../core/FileSystemUtils';

/**
 * Claude Code agent adapter (stub implementation).
 */
export class ClaudeAgent implements IAgent {
  getName(): string {
    return 'Claude Code';
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    agentConfig?: IAgentConfig,
  ): Promise<void> {
    const output =
      agentConfig?.outputPath ?? this.getDefaultOutputPath(projectRoot);
    await backupFile(output);
    await writeGeneratedFile(output, concatenatedRules);
  }
  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, 'CLAUDE.md');
  }
}
