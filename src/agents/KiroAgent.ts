import * as path from 'path';
import { AbstractAgent } from './AbstractAgent';

export class KiroAgent extends AbstractAgent {
  getIdentifier(): string {
    return 'kiro';
  }

  getName(): string {
    return 'Kiro';
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(
      projectRoot,
      '.kiro',
      'steering',
      'skiller_kiro_instructions.md',
    );
  }
}
