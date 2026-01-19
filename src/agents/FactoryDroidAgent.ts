import { AgentsMdAgent } from './AgentsMdAgent';

/**
 * Factory Droid agent adapter.
 * Uses the root-level AGENTS.md for instructions.
 */
export class FactoryDroidAgent extends AgentsMdAgent {
  getIdentifier(): string {
    return 'factory';
  }

  getName(): string {
    return 'Factory Droid';
  }

  getMcpServerKey(): string {
    return 'mcpServers';
  }

  supportsMcpStdio(): boolean {
    return true;
  }

  supportsMcpRemote(): boolean {
    return true;
  }

  supportsNativeSkills(): boolean {
    return true;
  }
}
