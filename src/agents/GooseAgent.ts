import * as path from 'path';
import { AbstractAgent } from './AbstractAgent';

/**
 * Goose agent adapter for Block's Goose AI assistant.
 * Propagates rules to .goosehints file.
 */
export class GooseAgent extends AbstractAgent {
  getIdentifier(): string {
    return 'goose';
  }

  getName(): string {
    return 'Goose';
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, '.goosehints');
  }

  getMcpServerKey(): string {
    // Goose doesn't support MCP configuration via local config files
    return '';
  }
}
