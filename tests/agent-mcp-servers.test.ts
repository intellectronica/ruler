import * as fs from 'fs/promises';
import * as path from 'path';
import { setupTestProject, teardownTestProject, runRuler } from './harness';

describe('agent-scoped MCP servers', () => {
  let testProject: { projectRoot: string };

  afterEach(async () => {
    if (testProject) {
      await teardownTestProject(testProject.projectRoot);
    }
  });

  it('applies agent-specific server definitions with the same server name', async () => {
    const toml = `
[agents.cursor.mcp_servers.slack]
url = "https://mcp.slack.com/mcp"
auth = { CLIENT_ID = "CURSOR_ID" }

[agents.claude.mcp_servers.slack]
type = "http"
url = "https://mcp.slack.com/mcp"
oauth = { clientId = "CLAUDE_ID", callbackPort = 3118 }
`;

    testProject = await setupTestProject({
      '.ruler/AGENTS.md': '# Test instructions',
      '.ruler/ruler.toml': toml,
    });

    const { projectRoot } = testProject;
    runRuler('apply --agents cursor,claude', projectRoot);

    const cursorMcp = JSON.parse(
      await fs.readFile(path.join(projectRoot, '.cursor', 'mcp.json'), 'utf8'),
    );
    expect(cursorMcp.mcpServers.slack).toEqual({
      url: 'https://mcp.slack.com/mcp',
      auth: { CLIENT_ID: 'CURSOR_ID' },
    });

    const claudeMcp = JSON.parse(
      await fs.readFile(path.join(projectRoot, '.mcp.json'), 'utf8'),
    );
    expect(claudeMcp.mcpServers.slack).toEqual({
      type: 'http',
      url: 'https://mcp.slack.com/mcp',
      oauth: { clientId: 'CLAUDE_ID', callbackPort: 3118 },
    });
  });

  it('normalizes mixed agent-specific server definitions as remote servers', async () => {
    const toml = `
[agents.cursor.mcp_servers.search]
type = "stdio"
command = "node"
args = ["local-server.js"]
env = { LOCAL_ONLY = "1" }
url = "https://search.example.com/mcp"
headers = { Authorization = "Bearer remote-token" }
`;

    testProject = await setupTestProject({
      '.ruler/AGENTS.md': '# Test instructions',
      '.ruler/ruler.toml': toml,
    });

    const { projectRoot } = testProject;
    runRuler('apply --agents cursor', projectRoot);

    const cursorMcp = JSON.parse(
      await fs.readFile(path.join(projectRoot, '.cursor', 'mcp.json'), 'utf8'),
    );
    expect(cursorMcp.mcpServers.search).toEqual({
      type: 'remote',
      url: 'https://search.example.com/mcp',
      headers: { Authorization: 'Bearer remote-token' },
    });
  });
});
