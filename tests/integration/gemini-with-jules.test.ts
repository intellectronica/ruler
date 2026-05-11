import * as fs from 'fs/promises';
import * as path from 'path';
import { setupTestProject, teardownTestProject, runRulerWithInheritedStdio } from '../harness';

describe('Gemini MCP merge even if AGENTS.md already written by Jules', () => {
  let projectRoot: string;

  beforeAll(async () => {
    const tmp = await setupTestProject({
      '.ruler/AGENTS.md': 'Rule A',
      '.ruler/mcp.json': JSON.stringify({
        mcpServers: {
          ex: { command: 'uvx', args: ['mcp-ex'] }
        }
      })
    });
    projectRoot = tmp.projectRoot;
  });

  afterAll(async () => {
    await teardownTestProject(projectRoot);
  });

  it('keeps mcpServers in .gemini/settings.json when running jules,gemini-cli', async () => {
    runRulerWithInheritedStdio('apply --agents jules,gemini-cli', projectRoot);
    const settingsPath = path.join(projectRoot, '.gemini', 'settings.json');
    const raw = await fs.readFile(settingsPath, 'utf8');
    const json = JSON.parse(raw);
    expect(json.mcpServers).toBeDefined();
    expect(Object.keys(json.mcpServers)).toContain('ex');
  });
});

