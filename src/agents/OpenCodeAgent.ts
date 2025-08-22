import { AgentsMdAgent } from './AgentsMdAgent';

// OpenCode agent now reuses AgentsMdAgent idempotent write to AGENTS.md.
// Only customization needed is identifier, name, and custom MCP server key.
export class OpenCodeAgent extends AgentsMdAgent {
  getIdentifier(): string {
    return 'opencode';
  }
  getName(): string {
    return 'OpenCode';
  }
  getMcpServerKey(): string {
    return 'mcp';
  }
}
