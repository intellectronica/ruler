import * as path from 'path';
import { AbstractAgent } from './AbstractAgent';

/**
 * Trae AI agent adapter.
 * Generates project_rules.md configuration file.
 */
export class TraeAgent extends AbstractAgent {
  getIdentifier(): string {
    return 'trae';
  }

  getName(): string {
    return 'Trae AI';
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, '.trae', 'rules', 'project_rules.md');
  }
}
