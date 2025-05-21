import * as path from 'path';
import { IAgent } from './IAgent';
import { backupFile, writeGeneratedFile } from '../core/FileSystemUtils';

/**
 * OpenAI Codex CLI agent adapter (stub implementation).
 */
export class CodexCliAgent implements IAgent {
  getName(): string {
    return 'OpenAI Codex CLI';
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
  ): Promise<void> {
    const target = path.join(projectRoot, 'AGENTS.md');
    await backupFile(target);
    await writeGeneratedFile(target, concatenatedRules);
  }
}
