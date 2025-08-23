import { promises as fs } from 'fs';
import * as path from 'path';
import { QwenCodeAgent } from '../../../src/agents/QwenCodeAgent';
import { AgentsMdAgent } from '../../../src/agents/AgentsMdAgent';
import { setupTestProject, teardownTestProject } from '../../harness';

describe('QwenCodeAgent', () => {
  it('should be defined', () => {
    expect(new QwenCodeAgent()).toBeDefined();
  });

  it('should extend AgentsMdAgent', () => {
    const agent = new QwenCodeAgent();
    expect(agent instanceof AgentsMdAgent).toBe(true);
  });

  it('should use mcpServers as MCP key', () => {
    const agent = new QwenCodeAgent();
    expect(agent.getMcpServerKey()).toBe('mcpServers');
  });

  it('writes AGENTS.md and sets contextFileName in .qwen/settings.json', async () => {
    const { projectRoot } = await setupTestProject({
      '.ruler/AGENTS.md': 'Rule A',
    });
    try {
      const agent = new QwenCodeAgent();
      const rules = 'Combined rules\n- Rule A';

      await agent.applyRulerConfig(rules, projectRoot, null);

      // AGENTS.md should be written at the repository root
      const agentsMdPath = path.join(projectRoot, 'AGENTS.md');
      await expect(fs.readFile(agentsMdPath, 'utf8')).resolves.toContain('Rule A');

      // .qwen/settings.json should include contextFileName: "AGENTS.md"
      const settingsPath = path.join(projectRoot, '.qwen', 'settings.json');
      const settingsRaw = await fs.readFile(settingsPath, 'utf8');
      const settings = JSON.parse(settingsRaw);
      expect(settings.contextFileName).toBe('AGENTS.md');
    } finally {
      await teardownTestProject(projectRoot);
    }
  });

  it('preserves existing settings and adds/updates contextFileName', async () => {
    const { projectRoot } = await setupTestProject({
      '.ruler/AGENTS.md': 'Rule X',
      '.qwen/settings.json': JSON.stringify({
        someSetting: true,
        mcpServers: { existing: { url: 'http://example' } },
      }),
    });
    try {
      const agent = new QwenCodeAgent();
      await agent.applyRulerConfig('Rules', projectRoot, null);

      const settingsPath = path.join(projectRoot, '.qwen', 'settings.json');
      const settingsRaw = await fs.readFile(settingsPath, 'utf8');
      const settings = JSON.parse(settingsRaw);

      expect(settings.someSetting).toBe(true);
      // Ensure any existing mcpServers are preserved (merge happens in apply engine, this just shouldn't remove)
      expect(settings.mcpServers).toEqual({ existing: { url: 'http://example' } });
      // Ensure contextFileName is set to AGENTS.md
      expect(settings.contextFileName).toBe('AGENTS.md');
    } finally {
      await teardownTestProject(projectRoot);
    }
  });
});