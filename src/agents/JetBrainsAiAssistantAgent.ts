import * as path from 'path';
import { AbstractAgent } from './AbstractAgent';

/**
 * JetBrains AI Assistant agent adapter.
 * Writes rules to .aiassistant/rules/AGENTS.md.
 */
export class JetBrainsAiAssistantAgent extends AbstractAgent {
  getIdentifier(): string {
    return 'jetbrains-ai';
  }

  getName(): string {
    return 'JetBrains AI Assistant';
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, '.aiassistant', 'rules', 'AGENTS.md');
  }
}
