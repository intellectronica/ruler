import * as path from 'path';
import { AbstractAgent } from './AbstractAgent';

/**
 * GitHub Copilot agent adapter.
 */
export class CopilotAgent extends AbstractAgent {
  getIdentifier(): string {
    return 'copilot';
  }

  getName(): string {
    return 'GitHub Copilot';
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, '.github', 'copilot-instructions.md');
  }

  getMcpServerKey(): string {
    return 'servers';
  }
}
