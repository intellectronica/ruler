import * as path from 'path';
import { AbstractAgent } from './AbstractAgent';

/**
 * Antigravity agent adapter.
 */
export class AntigravityAgent extends AbstractAgent {
  getIdentifier(): string {
    return 'antigravity';
  }

  getName(): string {
    return 'Antigravity';
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, '.agent', 'rules', 'ruler.md');
  }
}
