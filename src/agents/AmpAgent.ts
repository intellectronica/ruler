import { AgentsMdAgent } from './AgentsMdAgent';

export class AmpAgent extends AgentsMdAgent {
  getIdentifier(): string {
    return 'amp';
  }

  getName(): string {
    return 'Amp';
  }

  supportsMcp(): boolean {
    return true; // Override AgentsMdAgent's false default
  }
}
