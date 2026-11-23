import * as fs from 'fs/promises';
import * as path from 'path';
import { parse as parseTOML } from '@iarna/toml';
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

[mcp_servers.events]
url = "https://mcp.example.com/sse"
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
      type: 'http',
    });

    expect(config.mcpServers).toHaveProperty('api');
    expect(config.mcpServers.api).toEqual({
      url: 'https://api.example.com/mcp',
      type: 'http',
    });

    expect(config.mcpServers.events).toEqual({
      url: 'https://mcp.example.com/sse',
      type: 'sse',
    });
  });

  it('writes Codex remote headers as http_headers', async () => {
    const { projectRoot } = testProject;

    runRuler('apply --agents codex', projectRoot);

    const configPath = path.join(projectRoot, '.codex', 'config.toml');
    const content = await fs.readFile(configPath, 'utf8');
    const config = parseTOML(content) as Record<string, any>;

    expect(config.mcp_servers.search).toEqual({
      url: 'https://mcp.example.com',
      http_headers: {
        Authorization: 'Bearer TOKEN123',
        'X-API-Version': 'v1',
      },
    });
    expect(config.mcp_servers.api).toEqual({
      url: 'https://api.example.com/mcp',
    });
    expect(config.mcp_servers.events).toEqual({
      url: 'https://mcp.example.com/sse',
    });
  });

  it('propagates mixed command/url TOML servers as http', async () => {
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
        type: 'http',
      });
    } finally {
      await teardownTestProject(mixedProject.projectRoot);
    }
  });
});
