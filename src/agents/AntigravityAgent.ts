import * as path from 'path';
import { AbstractAgent } from './AbstractAgent';
import { ANTIGRAVITY_SKILLS_PATH } from '../constants';

/**
 * Antigravity agent adapter.
 */
export class AntigravityAgent extends AbstractAgent {
  getIdentifier(): string {
    return 'antigravity';
  }

  getName(): string {
    return 'Antigravity';
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, '.agent', 'rules', 'ruler.md');
  }

  supportsNativeSkills(): boolean {
    return true;
  }

  getNativeSkillsPath(projectRoot: string): string {
    return path.join(projectRoot, ANTIGRAVITY_SKILLS_PATH);
  }
}
