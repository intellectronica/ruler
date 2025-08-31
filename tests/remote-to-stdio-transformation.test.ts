import * as fs from 'fs/promises';
import * as path from 'path';
import * as toml from 'toml';
import { setupTestProject, teardownTestProject, runRuler } from './harness';

describe('remote-to-stdio-transformation', () => {
  let testProject: { projectRoot: string };

  beforeEach(async () => {
    const rulerToml = `[mcp]
enabled = true
merge_strategy = "merge"

[mcp_servers.filesystem]
command = "npx"
args = ["-y", "server-filesystem", "/tmp"]

[mcp_servers.remote_api]
url = "https://api.example.com/mcp"

[mcp_servers.remote_with_headers]
url = "https://example.com/mcp"

[mcp_servers.remote_with_headers.headers]
Authorization = "Bearer TOKEN123"
"X-API-Version" = "v1"
`;

    testProject = await setupTestProject({
      '.ruler/ruler.toml': rulerToml,
    });
  });

  afterEach(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('transforms remote servers to stdio servers for CodexCli agent', async () => {
    const { projectRoot } = testProject;

    // Run ruler apply for CodexCli agent (stdio-only)
    runRuler('apply --agents codex', projectRoot);

    // Check the generated config
    const configPath = path.join(projectRoot, '.codex', 'config.toml');
    const content = await fs.readFile(configPath, 'utf8');

    // Verify the TOML contains the expected transformations
    expect(content).toContain('[mcp_servers.filesystem]');
    expect(content).toContain('command = "npx"');
    // Check for array contents flexibly (spaces around brackets are valid TOML formatting)
    expect(content).toMatch(
      /args\s*=\s*\[\s*"-y",?\s*"server-filesystem",?\s*"\/tmp"\s*\]/,
    );

    expect(content).toContain('[mcp_servers.remote_api]');
    expect(content).toMatch(
      /args\s*=\s*\[\s*"-y",?\s*"mcp-remote@latest",?\s*"https:\/\/api\.example\.com\/mcp"\s*\]/,
    );

    expect(content).toContain('[mcp_servers.remote_with_headers]');
    expect(content).toMatch(
      /args\s*=\s*\[\s*"-y",?\s*"mcp-remote@latest",?\s*"https:\/\/example\.com\/mcp"\s*\]/,
    );
    // @iarna/toml formats nested objects as separate tables
    expect(content).toContain('[mcp_servers.remote_with_headers.headers]');
    expect(content).toContain('Authorization = "Bearer TOKEN123"');
    expect(content).toContain('X-API-Version = "v1"');
  });

  it('does not transform remote servers for agents that support both stdio and remote', async () => {
    const { projectRoot } = testProject;

    // Run ruler apply for Copilot agent (supports both stdio and remote)
    runRuler('apply --agents copilot', projectRoot);

    // Check the generated config
    const configPath = path.join(projectRoot, '.vscode', 'mcp.json');
    const content = await fs.readFile(configPath, 'utf8');

    // Verify that remote servers are preserved as remote (not transformed to stdio)
    expect(content).toContain('"filesystem"');
    expect(content).toContain('"command": "npx"');
    expect(content).toContain('"-y",');
    expect(content).toContain('"server-filesystem",');
    expect(content).toContain('"/tmp"');

    expect(content).toContain('"remote_api"');
    expect(content).toContain('"url": "https://api.example.com/mcp"');
    expect(content).toContain('"type": "remote"');

    expect(content).toContain('"remote_with_headers"');
    expect(content).toContain('"url": "https://example.com/mcp"');
    expect(content).toContain('"Authorization": "Bearer TOKEN123"');
    expect(content).toContain('"X-API-Version": "v1"');

    // Verify that remote servers are NOT transformed to use mcp-remote
    expect(content).not.toContain('mcp-remote@latest');
  });
});
