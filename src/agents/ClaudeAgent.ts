import * as path from 'path';
import { AbstractAgent } from './AbstractAgent';
import { CustomCommandsConfig } from '../types';
import { CommandProcessor } from '../core/CommandProcessor';

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

  supportsCustomCommands(): boolean {
    return true;
  }

  getSupportedCommandTypes(): string[] {
    return ['slash', 'instruction'];
  }

  async generateCustomCommands(
    commands: CustomCommandsConfig,
    projectRoot: string, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<string | null> {
    return CommandProcessor.generateClaudeSlashCommands(commands);
  }
}
