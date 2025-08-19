import * as path from 'path';
import { AbstractAgent } from './AbstractAgent';

/**
 * Cline agent adapter.
 */
export class ClineAgent extends AbstractAgent {
  getIdentifier(): string {
    return 'cline';
  }

  getName(): string {
    return 'Cline';
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, '.clinerules');
  }
}
