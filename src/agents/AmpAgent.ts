import { AgentsMdAgent } from './AgentsMdAgent';

export class AmpAgent extends AgentsMdAgent {
  getIdentifier(): string {
    return 'amp';
  }

  getName(): string {
    return 'Amp';
  }

  // Amp doesn't support configuring MCP servers
  supportsMcp(): boolean {
    return false;
  }
}
