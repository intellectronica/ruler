import * as path from 'path';
import { AbstractAgent } from './AbstractAgent';

/**
 * JetBrains Junie agent adapter.
 */
export class JunieAgent extends AbstractAgent {
  getIdentifier(): string {
    return 'junie';
  }

  getName(): string {
    return 'Junie';
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, '.junie', 'guidelines.md');
  }
}
