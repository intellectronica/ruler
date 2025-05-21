import * as path from 'path';
import { IAgent } from './IAgent';
import {
  backupFile,
  writeGeneratedFile,
  ensureDirExists,
} from '../core/FileSystemUtils';

/**
 * Windsurf agent adapter (stub implementation).
 */
export class WindsurfAgent implements IAgent {
  getName(): string {
    return 'Windsurf';
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
  ): Promise<void> {
    const targetDir = path.join(projectRoot, '.windsurf', 'rules');
    await ensureDirExists(targetDir);
    const target = path.join(targetDir, 'ruler_windsurf_instructions.md');
    await backupFile(target);
    await writeGeneratedFile(target, concatenatedRules);
  }
}
