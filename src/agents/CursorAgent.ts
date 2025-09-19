import * as path from 'path';
import { AbstractAgent } from './AbstractAgent';
import { IAgentConfig } from './IAgent';
import { CustomCommandsConfig } from '../types';
import {
  backupFile,
  writeGeneratedFile,
  ensureDirExists,
} from '../core/FileSystemUtils';
import { CommandProcessor } from '../core/CommandProcessor';

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
    customCommands?: CustomCommandsConfig,
  ): Promise<void> {
    let finalContent = concatenatedRules;

    // Add custom commands support
    if (customCommands && Object.keys(customCommands).length > 0) {
      const cursorCommands = CommandProcessor.generateCursorCommands(customCommands);
      finalContent += cursorCommands;
    }

    const output =
      agentConfig?.outputPath ?? this.getDefaultOutputPath(projectRoot);
    const absolutePath = path.resolve(projectRoot, output);

    // Cursor expects a YAML front-matter block with an `alwaysApply` flag.
    // See: https://docs.cursor.com/context/rules#rule-anatomy
    const frontMatter = ['---', 'alwaysApply: true', '---', ''].join('\n');
    const content = `${frontMatter}${finalContent.trimStart()}`;

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

  supportsCustomCommands(): boolean {
    return true;
  }

  getSupportedCommandTypes(): string[] {
    return ['instruction'];
  }

  async generateCustomCommands(
    commands: CustomCommandsConfig,
    projectRoot: string, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<string | null> {
    return CommandProcessor.generateCursorCommands(commands);
  }
}
