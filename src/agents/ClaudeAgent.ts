import * as path from 'path';
import { AbstractAgent } from './AbstractAgent';

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

  supportsNativeSkills(): boolean {
    return true;
  }
}
