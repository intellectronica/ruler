import * as path from 'path';
import { AbstractAgent } from './AbstractAgent';

/**
 * Windsurf agent adapter.
 */
export class WindsurfAgent extends AbstractAgent {
  getIdentifier(): string {
    return 'windsurf';
  }

  getName(): string {
    return 'Windsurf';
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(
      projectRoot,
      '.windsurf',
      'rules',
      'ruler_windsurf_instructions.md',
    );
  }

  supportsMcpStdio(): boolean {
    return true;
  }

  supportsMcpRemote(): boolean {
    return true;
  }
}
