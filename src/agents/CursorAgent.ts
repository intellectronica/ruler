import * as path from 'path';
import { AbstractAgent } from './AbstractAgent';
import { IAgentConfig } from './IAgent';
import { CommandConfig } from '../types';
import {
  backupFile,
  writeGeneratedFile,
  ensureDirExists,
} from '../core/FileSystemUtils';

/**
 * Cursor agent adapter.
 */
export class CursorAgent extends AbstractAgent {
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
    backup = true,
  ): Promise<void> {
    const output =
      agentConfig?.outputPath ?? this.getDefaultOutputPath(projectRoot);
    const absolutePath = path.resolve(projectRoot, output);

    // Cursor expects a YAML front-matter block with an `alwaysApply` flag.
    // See: https://docs.cursor.com/context/rules#rule-anatomy
    const frontMatter = ['---', 'alwaysApply: true', '---', ''].join('\n');
    const content = `${frontMatter}${concatenatedRules.trimStart()}`;

    await ensureDirExists(path.dirname(absolutePath));
    if (backup) {
      await backupFile(absolutePath);
    }
    await writeGeneratedFile(absolutePath, content);
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(
      projectRoot,
      '.cursor',
      'rules',
      'ruler_cursor_instructions.mdc',
    );
  }

  supportsMcpStdio(): boolean {
    return true;
  }

  supportsMcpRemote(): boolean {
    return true;
  }

  async applyCommands(
    commands: Record<string, CommandConfig>,
    commandContents: Record<string, string>,
    projectRoot: string,
    backup = true,
  ): Promise<void> {
    await this.applyCommandsToDirectory(
      commands,
      commandContents,
      projectRoot,
      '.cursor/commands',
      backup,
    );
  }
}
