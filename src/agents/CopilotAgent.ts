import * as path from 'path';
import { IAgent } from './IAgent';
import {
  backupFile,
  writeGeneratedFile,
  ensureDirExists,
} from '../core/FileSystemUtils';

/**
 * GitHub Copilot agent adapter (stub implementation).
 */
export class CopilotAgent implements IAgent {
  getName(): string {
    return 'GitHub Copilot';
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
  ): Promise<void> {
    const targetDir = path.join(projectRoot, '.github');
    await ensureDirExists(targetDir);
    const target = path.join(targetDir, 'copilot-instructions.md');
    await backupFile(target);
    await writeGeneratedFile(target, concatenatedRules);
  }
}
