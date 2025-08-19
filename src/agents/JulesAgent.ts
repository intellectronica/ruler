import * as path from 'path';
import { AbstractAgent } from './AbstractAgent';

export class JulesAgent extends AbstractAgent {
  getIdentifier(): string {
    return 'jules';
  }

  getName(): string {
    return 'Jules';
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, 'AGENTS.md');
  }
}
