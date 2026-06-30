import * as fs from 'fs/promises';
import * as path from 'path';
import { setupTestProject, teardownTestProject, runRuler } from './harness';

describe('apply-mcp.toml-disable', () => {
  let testProject: { projectRoot: string };

  beforeEach(async () => {
    const toml = `[mcp]
enabled = false

[mcp_servers.repo]
command = "node"
args = ["scripts/repo-mcp.js"]

[mcp_servers.search]
url = "https://example.com"
`;

    testProject = await setupTestProject({
      '.ruler/ruler.toml': toml,
      '.mcp.json': '{"mcpServers": {"existing": {"command": "existing-cmd"}}}',
    });
  });

  afterEach(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('does not apply TOML MCP servers when MCP is disabled', async () => {
    const { projectRoot } = testProject;

    const nativePath = path.join(projectRoot, '.mcp.json');
    const before = await fs.readFile(nativePath, 'utf8');

    runRuler('apply --agents copilot', projectRoot);

    const after = await fs.readFile(nativePath, 'utf8');
    expect(after).toEqual(before);
  });
});
