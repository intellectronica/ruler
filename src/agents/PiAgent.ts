import { AgentsMdAgent } from './AgentsMdAgent';

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
}
