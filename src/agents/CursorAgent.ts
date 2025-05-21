import * as path from 'path';
import { IAgent } from './IAgent';
import {
  backupFile,
  writeGeneratedFile,
  ensureDirExists,
} from '../core/FileSystemUtils';

/**
 * Cursor agent adapter (stub implementation).
 */
export class CursorAgent implements IAgent {
  getName(): string {
    return 'Cursor';
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
  ): Promise<void> {
    const targetDir = path.join(projectRoot, '.cursor', 'rules');
    await ensureDirExists(targetDir);
    const target = path.join(targetDir, 'ruler_cursor_instructions.md');
    await backupFile(target);
    await writeGeneratedFile(target, concatenatedRules);
  }
}
