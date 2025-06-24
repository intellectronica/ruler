import * as path from 'path';
import {
  backupFile,
  ensureDirExists,
  writeGeneratedFile,
} from '../core/FileSystemUtils';
import { IAgent, IAgentConfig } from './IAgent';

const CURSOR_RULES_PREFIX = `
---
alwaysApply: true
---

`;

/**
 * Cursor agent adapter (stub implementation).
 */
export class CursorAgent implements IAgent {
  getIdentifier(): string {
    return 'cursor';
  }

  getName(): string {
    return 'Cursor';
  }

  async applyRulerConfig(
    concatenatedRules: string,
    projectRoot: string,
    agentConfig?: IAgentConfig,
  ): Promise<void> {


    const output =
      agentConfig?.outputPath ?? this.getDefaultOutputPath(projectRoot);
    await ensureDirExists(path.dirname(output));
    await backupFile(output);
    await writeGeneratedFile(output, CURSOR_RULES_PREFIX + concatenatedRules);
  }
  getDefaultOutputPath(projectRoot: string): string {
    return path.join(
      projectRoot,
      '.cursor',
      'rules',
      'ruler_cursor_instructions.mdc',
    );
  }
}
