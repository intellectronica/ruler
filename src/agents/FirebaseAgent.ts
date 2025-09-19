import * as path from 'path';
import { AbstractAgent } from './AbstractAgent';

/**
 * Firebase Studio agent adapter.
 */
export class FirebaseAgent extends AbstractAgent {
  getIdentifier(): string {
    return 'firebase';
  }

  getName(): string {
    return 'Firebase Studio';
  }

  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, '.idx', 'airules.md');
  }

  // Firebase Studio (IDX) supports stdio MCP servers via .idx/mcp.json
  supportsMcpStdio(): boolean {
    return true;
  }

  // Remote MCP over HTTP/SSE is not documented for Firebase Studio yet
  supportsMcpRemote(): boolean {
    return false;
  }
}
