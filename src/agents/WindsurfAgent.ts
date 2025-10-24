import { AgentsMdAgent } from './AgentsMdAgent';

/**
 * Windsurf agent adapter.
 * Now uses AGENTS.md format like other agents.
 */
export class WindsurfAgent extends AgentsMdAgent {
  getIdentifier(): string {
    return 'windsurf';
  }

  getName(): string {
    return 'Windsurf';
  }

  // Windsurf supports MCP configuration
  getMcpServerKey(): string {
    return 'mcpServers';
  }

  supportsMcpStdio(): boolean {
    return true;
  }

  supportsMcpRemote(): boolean {
    return true;
  }
}
