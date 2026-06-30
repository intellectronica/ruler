import * as fs from 'fs/promises';
import * as path from 'path';
import { setupTestProject, teardownTestProject, runRuler } from './harness';

describe('apply-mcp.toml-remote', () => {
  let testProject: { projectRoot: string };

  beforeEach(async () => {
    const toml = `[mcp]
enabled = true
merge_strategy = "merge"

[mcp_servers.search]
url = "https://mcp.example.com"

[mcp_servers.search.headers]
Authorization = "Bearer TOKEN123"
"X-API-Version" = "v1"

[mcp_servers.api]
url = "https://api.example.com/mcp"
`;

    testProject = await setupTestProject({
      '.ruler/ruler.toml': toml,
      '.mcp.json': '{"mcpServers": {}}', // Empty native config
    });
  });

  afterEach(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('applies TOML-defined remote MCP servers to native config', async () => {
    const { projectRoot } = testProject;

    runRuler('apply --agents copilot', projectRoot);

    const nativePath = path.join(projectRoot, '.mcp.json');
    const content = await fs.readFile(nativePath, 'utf8');
    const config = JSON.parse(content);

    expect(config.mcpServers).toHaveProperty('search');
    expect(config.mcpServers.search).toEqual({
      url: 'https://mcp.example.com',
      headers: {
        Authorization: 'Bearer TOKEN123',
        'X-API-Version': 'v1',
      },
      type: 'remote',
    });

    expect(config.mcpServers).toHaveProperty('api');
    expect(config.mcpServers.api).toEqual({
      url: 'https://api.example.com/mcp',
      type: 'remote',
    });
  });

  it('propagates mixed command/url TOML servers as remote', async () => {
    const mixedProject = await setupTestProject({
      '.ruler/ruler.toml': `[mcp]
enabled = true
merge_strategy = "merge"

[mcp_servers.search]
command = "npx"
args = ["-y", "local-search"]
url = "https://mcp.example.com/search"

[mcp_servers.search.env]
TOKEN = "stdio-only"
`,
      '.mcp.json': '{"mcpServers": {}}',
    });

    try {
      runRuler('apply --agents copilot', mixedProject.projectRoot);

      const nativePath = path.join(mixedProject.projectRoot, '.mcp.json');
      const content = await fs.readFile(nativePath, 'utf8');
      const config = JSON.parse(content);

      expect(config.mcpServers.search).toEqual({
        url: 'https://mcp.example.com/search',
        type: 'remote',
      });
    } finally {
      await teardownTestProject(mixedProject.projectRoot);
    }
  });
});
