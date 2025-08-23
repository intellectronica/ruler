import { AgentsMdAgent } from './AgentsMdAgent';

export class AmpAgent extends AgentsMdAgent {
  getIdentifier(): string {
    return 'amp';
  }

  getName(): string {
    return 'Amp';
  }
}
