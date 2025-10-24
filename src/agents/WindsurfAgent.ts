import { AgentsMdAgent } from './AgentsMdAgent';

/**
 * Windsurf agent adapter.
 *
 * Windsurf now consumes the shared AGENTS.md instructions just like the other
 * AGENTS-aware agents. By extending {@link AgentsMdAgent} we reuse the
 * idempotent write behaviour and shared marker handling instead of maintaining
 * a bespoke `.windsurf/AGENTS.md` copy.
 */
export class WindsurfAgent extends AgentsMdAgent {
  getIdentifier(): string {
    return 'windsurf';
  }

  getName(): string {
    return 'Windsurf';
  }

  override getMcpServerKey(): string {
    return 'mcpServers';
  }

  override supportsMcpStdio(): boolean {
    return true;
  }

  override supportsMcpRemote(): boolean {
    return true;
  }
}
