import * as fs from 'fs/promises';
import * as path from 'path';
import {
  setupTestProject,
  teardownTestProject,
  runRulerWithInheritedStdio,
} from './harness';

describe('Gemini MCP key usage', () => {
  let projectRoot: string;

  beforeAll(async () => {
    const tmp = await setupTestProject({
      '.ruler/AGENTS.md': 'Rule A',
      '.ruler/mcp.json': JSON.stringify({
        mcpServers: {
          example: { type: 'stdio', command: 'node', args: ['server.js'] },
        },
      }),
    });
    projectRoot = tmp.projectRoot;
  });

  afterAll(async () => {
    await teardownTestProject(projectRoot);
  });

  it('writes mcpServers key and contextFileName in .gemini/settings.json', async () => {
    runRulerWithInheritedStdio('apply --agents gemini-cli', projectRoot);
    const settingsPath = path.join(projectRoot, '.gemini', 'settings.json');
    const raw = await fs.readFile(settingsPath, 'utf8');
    const json = JSON.parse(raw);
    expect(json.contextFileName).toBe('AGENTS.md');
    expect(json.mcpServers).toBeDefined();
    expect(json['']).toBeUndefined();
    expect(Object.keys(json.mcpServers)).toContain('example');
  });

  it('honors --no-mcp for Gemini MCP settings', async () => {
    const tmp = await setupTestProject({
      '.ruler/AGENTS.md': 'Rule A',
      '.ruler/mcp.json': JSON.stringify({
        mcpServers: {
          example: { type: 'stdio', command: 'node', args: ['server.js'] },
        },
      }),
      '.gemini/settings.json': JSON.stringify({
        mcpServers: {
          existing: { command: 'old-server' },
        },
      }),
    });

    try {
      runRulerWithInheritedStdio(
        'apply --agents gemini-cli --no-mcp',
        tmp.projectRoot,
      );
      const raw = await fs.readFile(
        path.join(tmp.projectRoot, '.gemini', 'settings.json'),
        'utf8',
      );
      const json = JSON.parse(raw);
      expect(Object.keys(json.mcpServers)).toEqual(['existing']);
      expect(json.contextFileName).toBe('AGENTS.md');
    } finally {
      await teardownTestProject(tmp.projectRoot);
    }
  });

  it('honors global overwrite strategy for Gemini MCP settings', async () => {
    const tmp = await setupTestProject({
      '.ruler/AGENTS.md': 'Rule A',
      '.ruler/ruler.toml': `
[mcp]
merge_strategy = "overwrite"

[mcp_servers.example]
command = "node"
args = ["server.js"]
`,
      '.gemini/settings.json': JSON.stringify({
        mcpServers: {
          existing: { command: 'old-server' },
        },
      }),
    });

    try {
      runRulerWithInheritedStdio('apply --agents gemini-cli', tmp.projectRoot);
      const raw = await fs.readFile(
        path.join(tmp.projectRoot, '.gemini', 'settings.json'),
        'utf8',
      );
      const json = JSON.parse(raw);
      expect(Object.keys(json.mcpServers)).toEqual(['example']);
      expect(json.contextFileName).toBe('AGENTS.md');
    } finally {
      await teardownTestProject(tmp.projectRoot);
    }
  });
});
