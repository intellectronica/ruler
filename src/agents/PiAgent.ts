import * as path from 'path';
import { AgentsMdAgent } from './AgentsMdAgent';
import { PI_SKILLS_PATH } from '../constants';

/**
 * Pi Coding Agent adapter.
 */
export class PiAgent extends AgentsMdAgent {
  getIdentifier(): string {
    return 'pi';
  }

  getName(): string {
    return 'Pi Coding Agent';
  }

  supportsNativeSkills(): boolean {
    return true;
  }

  getNativeSkillsPath(projectRoot: string): string {
    return path.join(projectRoot, PI_SKILLS_PATH);
  }
}
