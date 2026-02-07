import * as path from 'path';
import { AgentsMdAgent } from './AgentsMdAgent';
import { FACTORY_SKILLS_PATH } from '../constants';

/**
 * Factory Droid agent adapter.
 * Uses the root-level AGENTS.md for instructions.
 */
export class FactoryDroidAgent extends AgentsMdAgent {
  getIdentifier(): string {
    return 'factory';
  }

  getName(): string {
    return 'Factory Droid';
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

  supportsNativeSkills(): boolean {
    return true;
  }

  getNativeSkillsPath(projectRoot: string): string {
    return path.join(projectRoot, FACTORY_SKILLS_PATH);
  }
}
