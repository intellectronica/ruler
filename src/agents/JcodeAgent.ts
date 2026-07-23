import { AgentsMdAgent } from './AgentsMdAgent';

/**
 * Jcode agent adapter.
 * Writes AGENTS.md for rules and relies on apply-engine for MCP (.jcode/mcp.json).
 * See: https://github.com/1jehuang/jcode
 */
export class JcodeAgent extends AgentsMdAgent {
  getIdentifier(): string {
    return 'jcode';
  }

  getName(): string {
    return 'Jcode';
  }

  getMcpServerKey(): string {
    return 'mcpServers';
  }

  supportsMcpStdio(): boolean {
    return true;
  }

  supportsMcpRemote(): boolean {
    return false;
  }

  supportsNativeSkills(): boolean {
    return true;
  }
}
