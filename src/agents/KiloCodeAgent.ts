import * as path from 'path';
import { AbstractAgent } from './AbstractAgent';

/**
 * Kilo Code agent adapter.
 * Generates ruler_kilocode_instructions.md configuration file in .kilocode/rules/ directory.
 */
export class KiloCodeAgent extends AbstractAgent {
  getIdentifier(): string {
    return 'kilocode';
  }

  getName(): string {
    return 'Kilo Code';
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(
      projectRoot,
      '.kilocode',
      'rules',
      'ruler_kilocode_instructions.md',
    );
  }

  getMcpServerKey(): string {
    return 'mcpServers';
  }

  supportsMcpStdio(): boolean {
    return true;
  }

  supportsMcpRemote(): boolean {
    return true;
  }
}
