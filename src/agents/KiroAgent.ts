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
      'ruler_kiro_instructions.md',
    );
  }

  supportsMcpStdio(): boolean {
    return true;
  }

  supportsMcpRemote(): boolean {
    return true;
  }
}
