import * as fs from 'fs/promises';
import * as path from 'path';
import { setupTestProject, teardownTestProject, runRuler } from './harness';

describe('apply-mcp.toml-json-merge', () => {
  let testProject: { projectRoot: string };

  beforeEach(async () => {
    const toml = `[mcp]
enabled = true
merge_strategy = "merge"

[mcp_servers.repo]
command = "node"
args = ["scripts/new-repo-mcp.js"]

[mcp_servers.search]
url = "https://toml.example.com"
`;

    const mcpJson = {
      mcpServers: {
        repo: {
          command: 'uvx',
          args: ['old-repo-mcp'],
        },
        git: {
          command: 'npx',
          args: ['mcp-git'],
        },
      },
    };

    testProject = await setupTestProject({
      '.ruler/ruler.toml': toml,
      '.ruler/mcp.json': JSON.stringify(mcpJson, null, 2),
      '.mcp.json': '{"mcpServers": {}}', // Empty native config
    });
  });

  afterEach(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('merges TOML and JSON MCP servers with TOML taking precedence', async () => {
    const { projectRoot } = testProject;

    runRuler('apply --agents copilot', projectRoot);

    const nativePath = path.join(projectRoot, '.mcp.json');
    const content = await fs.readFile(nativePath, 'utf8');
    const config = JSON.parse(content);

    // TOML should override JSON for 'repo' server
    expect(config.mcpServers.repo).toEqual({
      command: 'node',
      args: ['scripts/new-repo-mcp.js'],
      type: 'stdio',
    });

    // TOML-only server should be present
    expect(config.mcpServers.search).toEqual({
      url: 'https://toml.example.com',
      type: 'remote',
    });

    // JSON-only server should be present
    expect(config.mcpServers.git).toEqual({
      command: 'npx',
      args: ['mcp-git'],
      type: 'stdio',
    });
  });
});
