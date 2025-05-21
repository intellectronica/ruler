import * as path from 'path';
import { IAgent } from './IAgent';
import { backupFile, writeGeneratedFile } from '../core/FileSystemUtils';

/**
 * Cline agent adapter (stub implementation).
 */
export class ClineAgent implements IAgent {
  getName(): string {
    return 'Cline';
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
  ): Promise<void> {
    const target = path.join(projectRoot, '.clinerules');
    await backupFile(target);
    await writeGeneratedFile(target, concatenatedRules);
  }
}
