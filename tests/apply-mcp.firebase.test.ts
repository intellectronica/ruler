import * as fs from 'fs/promises';
import * as path from 'path';
import { setupTestProject, teardownTestProject, runRuler } from './harness';

/**
 * Firebase Studio should not include a 'type' field in .idx/mcp.json servers.
 */
describe('apply-mcp.firebase', () => {
  let testProject: { projectRoot: string };

  beforeEach(async () => {
    const toml = `[mcp]
enabled = true
merge_strategy = "merge"

[mcp_servers.repo]
command = "node"
args = ["scripts/repo-mcp.js"]

[mcp_servers.git]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-git", "--repository", "."]
`;

    testProject = await setupTestProject({
      '.ruler/ruler.toml': toml,
      '.idx/mcp.json': '{"mcpServers": {}}' // Empty native config for Firebase Studio
    });
  });

  afterEach(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('omits type fields in .idx/mcp.json', async () => {
    const { projectRoot } = testProject;

    runRuler('apply --agents firebase', projectRoot);

    const nativePath = path.join(projectRoot, '.idx', 'mcp.json');
    const content = await fs.readFile(nativePath, 'utf8');
    const config = JSON.parse(content);

    expect(config.mcpServers).toHaveProperty('repo');
    expect(config.mcpServers.repo).toEqual({
      command: 'node',
      args: ['scripts/repo-mcp.js']
    });

    expect(config.mcpServers).toHaveProperty('git');
    expect(config.mcpServers.git).toEqual({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-git', '--repository', '.']
    });

    // Ensure no 'type' property exists at server entries
    for (const server of Object.values(config.mcpServers)) {
      expect((server as any).type).toBeUndefined();
    }
  });
});
