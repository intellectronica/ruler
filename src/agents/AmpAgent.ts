import * as path from 'path';
import { AbstractAgent } from './AbstractAgent';

export class AmpAgent extends AbstractAgent {
  getIdentifier(): string {
    return 'amp';
  }

  getName(): string {
    return 'Amp';
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, 'AGENT.md');
  }
}
