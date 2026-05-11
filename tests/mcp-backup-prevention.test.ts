import { promises as fs } from 'fs';
import * as path from 'path';
import { setupTestProject, teardownTestProject, runRuler } from './harness';

describe('MCP Backup Prevention for All Agents', () => {
  let projectRoot: string;

  beforeAll(async () => {
    const tmp = await setupTestProject({
      '.ruler/AGENTS.md': 'Rule A\nRule B\n',
      '.ruler/mcp.json': JSON.stringify({
        mcpServers: {
          'test-server': {
            command: 'echo',
            args: ['hello'],
            type: 'stdio'
          }
        }
      })
    });
    projectRoot = tmp.projectRoot;
  });

  afterAll(async () => {
    await teardownTestProject(projectRoot);
  });

  const mcpAgents = [
    { name: 'gemini-cli', configPath: '.gemini/settings.json' },
    { name: 'copilot', configPath: 'AGENTS.md' }, // Uses AgentsMdAgent + MCP handled by engine
    { name: 'claude', configPath: 'CLAUDE.md' }, // Uses AbstractAgent + MCP handled by engine
    { name: 'cursor', configPath: 'AGENTS.md' }, // Uses AgentsMdAgent + MCP handled by engine
  ];

  mcpAgents.forEach(({ name, configPath }) => {
    it(`should handle MCP correctly for ${name} agent without creating backup files`, async () => {
      // Clean up any existing files from previous tests
      const fullConfigPath = path.join(projectRoot, configPath);
      const backupPath = fullConfigPath + '.bak';
      
      try { await fs.rm(fullConfigPath, { force: true }); } catch {}
      try { await fs.rm(backupPath, { force: true }); } catch {}
      
      // Run ruler apply with specific agent
      await runRuler(`apply --agents ${name}`, projectRoot);

      // Check that the main config file exists
      const mainFileExists = await fs.access(fullConfigPath).then(() => true).catch(() => false);
      expect(mainFileExists).toBe(true);

      // For agents that write MCP data, check it exists
      if (name === 'gemini-cli') {
        const content = await fs.readFile(fullConfigPath, 'utf8');
        const config = JSON.parse(content);
        expect(config.contextFileName).toBe('AGENTS.md');
        expect(config.mcpServers).toBeDefined();
      }

      // Key test: Check that no backup file was created
      const backupExists = await fs.access(backupPath).then(() => true).catch(() => false);
      expect(backupExists).toBe(false);
    });
  });

  it('should handle idempotent re-runs without creating backup files', async () => {
    // Run twice with gemini to test idempotency
    await runRuler('apply --agents gemini-cli', projectRoot);
    
    const settingsPath = path.join(projectRoot, '.gemini', 'settings.json');
    const firstContent = await fs.readFile(settingsPath, 'utf8');
    
    // Run again
    await runRuler('apply --agents gemini-cli', projectRoot);
    
    const secondContent = await fs.readFile(settingsPath, 'utf8');
    const backupPath = settingsPath + '.bak';
    
    // Content should be identical
    expect(firstContent).toBe(secondContent);
    
    // No backup should be created on second run
    const backupExists = await fs.access(backupPath).then(() => true).catch(() => false);
    expect(backupExists).toBe(false);
  });
});