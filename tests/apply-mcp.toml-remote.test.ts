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
      '.vscode/mcp.json': '{"mcpServers": {}}'  // Empty native config
    });
  });

  afterEach(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('applies TOML-defined remote MCP servers to native config', async () => {
    const { projectRoot } = testProject;
    
    runRuler('apply --agents copilot', projectRoot);
    
    const nativePath = path.join(projectRoot, '.vscode', 'mcp.json');
    const content = await fs.readFile(nativePath, 'utf8');
    const config = JSON.parse(content);
    
    expect(config.servers).toHaveProperty('search');
    expect(config.servers.search).toEqual({
      url: 'https://mcp.example.com',
      headers: { 
        Authorization: 'Bearer TOKEN123',
        'X-API-Version': 'v1'
      },
      type: 'remote'
    });
    
    expect(config.servers).toHaveProperty('api');
    expect(config.servers.api).toEqual({
      url: 'https://api.example.com/mcp',
      type: 'remote'
    });
  });
});