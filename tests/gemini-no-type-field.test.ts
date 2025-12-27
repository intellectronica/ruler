import { promises as fs } from 'fs';
import * as path from 'path';
import {
  setupTestProject,
  teardownTestProject,
  runRuler,
} from '../tests/harness';

describe('Gemini CLI MCP Type Field Test', () => {
  let projectRoot: string;

  beforeAll(async () => {
    const tmp = await setupTestProject({
      '.ruler/AGENTS.md': 'Test rules for Gemini CLI\n',
      '.ruler/ruler.toml': `
[mcp_servers.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]

[mcp_servers.remote_api]
url = "https://api.example.com/mcp"
headers = { Authorization = "Bearer secret" }
`,
    });
    projectRoot = tmp.projectRoot;
  });

  afterAll(async () => {
    await teardownTestProject(projectRoot);
  });

  it('should not include type field in Gemini CLI settings.json (following Nov 2025 MCP spec update)', async () => {
    // Run ruler apply with gemini-cli
    await runRuler('apply --agents gemini-cli', projectRoot);

    const settingsPath = path.join(projectRoot, '.gemini', 'settings.json');

    // Read and parse settings.json
    const settingsContent = await fs.readFile(settingsPath, 'utf8');
    const settings = JSON.parse(settingsContent);

    // Verify basic structure
    expect(settings.contextFileName).toBe('AGENTS.md');
    expect(settings.mcpServers).toBeDefined();

    // Verify stdio server exists and has no type field
    expect(settings.mcpServers.filesystem).toBeDefined();
    expect(settings.mcpServers.filesystem.command).toBe('npx');
    expect(settings.mcpServers.filesystem.args).toEqual([
      '-y',
      '@modelcontextprotocol/server-filesystem',
      '/tmp',
    ]);
    expect(settings.mcpServers.filesystem.type).toBeUndefined();

    // Verify remote server exists and has no type field
    expect(settings.mcpServers.remote_api).toBeDefined();
    expect(settings.mcpServers.remote_api.url).toBe(
      'https://api.example.com/mcp',
    );
    expect(settings.mcpServers.remote_api.headers).toBeDefined();
    expect(settings.mcpServers.remote_api.type).toBeUndefined();

    // Ensure no server has a type field
    for (const [serverName, serverConfig] of Object.entries(
      settings.mcpServers,
    )) {
      if (serverConfig && typeof serverConfig === 'object') {
        expect((serverConfig as Record<string, unknown>).type).toBeUndefined();
      }
    }
  });

  it('should strip type field from existing servers during merge', async () => {
    // Create existing settings with type field
    const settingsPath = path.join(projectRoot, '.gemini', 'settings.json');
    await fs.mkdir(path.dirname(settingsPath), { recursive: true });
    await fs.writeFile(
      settingsPath,
      JSON.stringify(
        {
          contextFileName: 'AGENTS.md',
          mcpServers: {
            'old-server': {
              command: 'old-cmd',
              type: 'stdio',
            },
          },
        },
        null,
        2,
      ),
    );

    // Run ruler apply again
    await runRuler('apply --agents gemini-cli', projectRoot);

    // Read and verify
    const settingsContent = await fs.readFile(settingsPath, 'utf8');
    const settings = JSON.parse(settingsContent);

    // All servers should not have type field
    expect(settings.mcpServers['old-server']).toBeDefined();
    expect(settings.mcpServers['old-server'].type).toBeUndefined();
    expect(settings.mcpServers.filesystem).toBeDefined();
    expect(settings.mcpServers.filesystem.type).toBeUndefined();
    expect(settings.mcpServers.remote_api).toBeDefined();
    expect(settings.mcpServers.remote_api.type).toBeUndefined();
  });
});
