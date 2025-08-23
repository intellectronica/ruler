import * as fs from 'fs/promises';
import * as path from 'path';
import { setupTestProject, teardownTestProject, runRulerWithInheritedStdio } from './harness';

describe('Gemini MCP key usage', () => {
  let projectRoot: string;

  beforeAll(async () => {
    const tmp = await setupTestProject({
      '.ruler/AGENTS.md': 'Rule A',
      '.ruler/mcp.json': JSON.stringify({
        mcpServers: {
          example: { type: 'stdio', command: 'node', args: ['server.js'] }
        }
      })
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
});

