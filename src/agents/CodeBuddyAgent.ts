import * as path from 'path';
import { AbstractAgent } from './AbstractAgent';

/**
 * CodeBuddy agent adapter (CodeBuddy IDE, plugins, and CodeBuddy Code CLI).
 */
export class CodeBuddyAgent extends AbstractAgent {
  getIdentifier(): string {
    return 'codebuddy';
  }

  getName(): string {
    return 'CodeBuddy';
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, 'CODEBUDDY.md');
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

  supportsNativeSubagents(): boolean {
    return true;
  }
}
