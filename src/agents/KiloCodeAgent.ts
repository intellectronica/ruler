import * as path from 'path';
import { AgentsMdAgent } from './AgentsMdAgent';

/**
 * Kilo Code agent adapter.
 * Uses AGENTS.md for instructions and .kilocode/mcp.json for MCP configuration.
 */
export class KiloCodeAgent extends AgentsMdAgent {
  getIdentifier(): string {
    return 'kilocode';
  }

  getName(): string {
    return 'Kilo Code';
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, 'AGENTS.md');
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
