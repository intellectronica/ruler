import * as path from 'path';
import { AbstractAgent } from './AbstractAgent';

export class OpenHandsAgent extends AbstractAgent {
  getIdentifier(): string {
    return 'openhands';
  }

  getName(): string {
    return 'Open Hands';
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, '.openhands', 'microagents', 'repo.md');
  }

  supportsMcpStdio(): boolean {
    return true;
  }

  supportsMcpRemote(): boolean {
    return true;
  }
}
