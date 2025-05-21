import * as path from 'path';
import { IAgent } from './IAgent';
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
  ): Promise<void> {
    const target = path.join(projectRoot, 'CLAUDE.md');
    await backupFile(target);
    await writeGeneratedFile(target, concatenatedRules);
  }
}
