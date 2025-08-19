import * as path from 'path';
import { AbstractAgent } from './AbstractAgent';

/**
 * Firebase Studio agent adapter.
 */
export class FirebaseAgent extends AbstractAgent {
  getIdentifier(): string {
    return 'firebase';
  }

  getName(): string {
    return 'Firebase Studio';
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, '.idx', 'airules.md');
  }
}
