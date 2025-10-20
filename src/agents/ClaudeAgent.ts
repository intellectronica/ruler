import * as path from 'path';
import { AbstractAgent } from './AbstractAgent';
import { CommandConfig } from '../types';

/**
 * Claude Code agent adapter.
 */
export class ClaudeAgent extends AbstractAgent {
  getIdentifier(): string {
    return 'claude';
  }

  getName(): string {
    return 'Claude Code';
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, 'CLAUDE.md');
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
      '.claude/commands',
      backup,
    );
  }
}
