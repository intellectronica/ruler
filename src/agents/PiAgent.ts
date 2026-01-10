import { AgentsMdAgent } from './AgentsMdAgent';

/**
 * Pi coding agent adapter.
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
