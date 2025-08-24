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

  supportsLocalMcp(): boolean {
    return false; // OpenHands supports only remote MCP servers
  }

  supportsRemoteMcp(): boolean {
    return true;
  }
}
