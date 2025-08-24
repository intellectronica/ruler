import { AgentsMdAgent } from './AgentsMdAgent';

// Jules agent now simply inherits AgentsMdAgent behavior (idempotent AGENTS.md writes).
export class JulesAgent extends AgentsMdAgent {
  getIdentifier(): string {
    return 'jules';
  }
  getName(): string {
    return 'Jules';
  }

  // Jules doesn't support configuring MCP servers
  supportsMcp(): boolean {
    return false;
  }
}
