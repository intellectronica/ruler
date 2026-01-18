import * as path from 'path';
import { AbstractAgent } from './AbstractAgent';
import { CLAUDE_SKILLS_PATH } from '../constants';

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

  getNativeSkillsPath(projectRoot: string): string {
    return path.join(projectRoot, CLAUDE_SKILLS_PATH);
  }
}
