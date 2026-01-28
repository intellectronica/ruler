import * as path from 'path';
import { AgentsMdAgent } from './AgentsMdAgent';
import { GOOSE_SKILLS_PATH } from '../constants';

export class AmpAgent extends AgentsMdAgent {
  getIdentifier(): string {
    return 'amp';
  }

  getName(): string {
    return 'Amp';
  }

  supportsNativeSkills(): boolean {
    return true;
  }

  getNativeSkillsPath(projectRoot: string): string {
    return path.join(projectRoot, GOOSE_SKILLS_PATH);
  }
}
