import * as path from 'path';
import { IAgent, IAgentConfig } from './IAgent';
import {
  backupFile,
  writeGeneratedFile,
  ensureDirExists,
} from '../core/FileSystemUtils';

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
    rulerMcpJson: Record<string, unknown> | null, // eslint-disable-line @typescript-eslint/no-unused-vars
    agentConfig?: IAgentConfig,
  ): Promise<void> {
    const output =
      agentConfig?.outputPath ?? this.getDefaultOutputPath(projectRoot);

    // Cursor expects a YAML front-matter block with an `alwaysApply` flag.
    // See: https://docs.cursor.com/context/rules#rule-anatomy
    const frontMatter = ['---', 'alwaysApply: true', '---', ''].join('\n');
    const content = `${frontMatter}${concatenatedRules.trimStart()}`;

    await ensureDirExists(path.dirname(output));
    await backupFile(output, agentConfig?.disableBackup);
    await writeGeneratedFile(output, content);
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
