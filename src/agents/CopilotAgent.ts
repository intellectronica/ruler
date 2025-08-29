import { AgentsMdAgent } from './AgentsMdAgent';

/**
 * GitHub Copilot agent adapter.
 */
export class CopilotAgent extends AgentsMdAgent {
  getIdentifier(): string {
    return 'copilot';
  }

  getName(): string {
    return 'GitHub Copilot';
  }

  getMcpServerKey(): string {
    return 'servers';
  }

  supportsMcpStdio(): boolean {
    return true;
  }

  supportsMcpRemote(): boolean {
    return true;
  }
}
