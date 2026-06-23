import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import { setupTestProject, teardownTestProject, runRuler } from './harness';

describe('apply-mcp.toml-stdio', () => {
  let testProject: { projectRoot: string };

  beforeEach(async () => {
    const toml = `[mcp]
enabled = true
merge_strategy = "merge"

[mcp_servers.repo]
command = "node"
args = ["scripts/repo-mcp.js"]
env = { API_KEY = "abc123" }

[mcp_servers.git]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-git", "--repository", "."]
`;

    testProject = await setupTestProject({
      '.ruler/ruler.toml': toml,
      '.vscode/mcp.json': '{"mcpServers": {}}', // Empty native config
    });
  });

  afterEach(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('applies TOML-defined stdio MCP servers to native config', async () => {
    const { projectRoot } = testProject;

    runRuler('apply --agents copilot', projectRoot);

    const nativePath = path.join(projectRoot, '.vscode', 'mcp.json');
    const content = await fs.readFile(nativePath, 'utf8');
    const config = JSON.parse(content);

    expect(config.servers).toHaveProperty('repo');
    expect(config.servers.repo).toEqual({
      command: 'node',
      args: ['scripts/repo-mcp.js'],
      env: { API_KEY: 'abc123' },
      type: 'stdio',
    });

    expect(config.servers).toHaveProperty('git');
    expect(config.servers.git).toEqual({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-git', '--repository', '.'],
      type: 'stdio',
    });
  });

  it('applies global TOML MCP servers when local rules have no ruler.toml', async () => {
    const { projectRoot } = testProject;
    const xdgConfigHome = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ruler-global-config-'),
    );

    try {
      await fs.rm(path.join(projectRoot, '.ruler', 'ruler.toml'), {
        force: true,
      });
      await fs.writeFile(
        path.join(projectRoot, '.ruler', 'AGENTS.md'),
        '# Local rules',
      );
      const globalRulerDir = path.join(xdgConfigHome, 'ruler');
      await fs.mkdir(globalRulerDir, { recursive: true });
      await fs.writeFile(
        path.join(globalRulerDir, 'ruler.toml'),
        [
          '[mcp_servers.global]',
          'command = "node"',
          'args = ["server.js"]',
          '',
        ].join('\n'),
      );
      execFileSync(
        'node',
        [
          path.resolve('dist/cli/index.js'),
          'apply',
          '--project-root',
          projectRoot,
          '--agents',
          'cursor',
          '--no-backup',
          '--no-gitignore',
        ],
        {
          env: { ...process.env, XDG_CONFIG_HOME: xdgConfigHome },
          stdio: 'pipe',
        },
      );

      const nativePath = path.join(projectRoot, '.cursor', 'mcp.json');
      const config = JSON.parse(await fs.readFile(nativePath, 'utf8'));
      expect(config.mcpServers.global).toEqual({
        command: 'node',
        args: ['server.js'],
        type: 'stdio',
      });
    } finally {
      await fs.rm(xdgConfigHome, { recursive: true, force: true });
    }
  });
});
