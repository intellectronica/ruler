import { promises as fs } from 'fs';
import * as path from 'path';
import { GeminiCliAgent } from '../../../src/agents/GeminiCliAgent';
import { AgentsMdAgent } from '../../../src/agents/AgentsMdAgent';
import { setupTestProject, teardownTestProject } from '../../harness';

describe('GeminiCliAgent', () => {
  async function readGeminiSettings(
    projectRoot: string,
  ): Promise<Record<string, unknown>> {
    const settingsPath = path.join(projectRoot, '.gemini', 'settings.json');
    return JSON.parse(await fs.readFile(settingsPath, 'utf8'));
  }

  it('should be defined', () => {
    expect(new GeminiCliAgent()).toBeDefined();
  });

  it('should extend AgentsMdAgent', () => {
    const agent = new GeminiCliAgent();
    expect(agent instanceof AgentsMdAgent).toBe(true);
  });

  it('should use mcpServers as MCP key', () => {
    const agent = new GeminiCliAgent();
    expect(agent.getMcpServerKey()).toBe('mcpServers');
  });

  it('should support native skills', () => {
    const agent = new GeminiCliAgent();
    expect(agent.supportsNativeSkills()).toBe(true);
  });

  it('writes AGENTS.md and sets contextFileName in .gemini/settings.json', async () => {
    const { projectRoot } = await setupTestProject({
      '.ruler/AGENTS.md': 'Rule A',
    });
    try {
      const agent = new GeminiCliAgent();
      const rules = 'Combined rules\n- Rule A';

      await agent.applyRulerConfig(rules, projectRoot, null);

      // AGENTS.md should be written at the repository root
      const agentsMdPath = path.join(projectRoot, 'AGENTS.md');
      await expect(fs.readFile(agentsMdPath, 'utf8')).resolves.toContain(
        'Rule A',
      );

      // .gemini/settings.json should include contextFileName: "AGENTS.md"
      const settingsPath = path.join(projectRoot, '.gemini', 'settings.json');
      const settingsRaw = await fs.readFile(settingsPath, 'utf8');
      const settings = JSON.parse(settingsRaw);
      expect(settings.contextFileName).toBe('AGENTS.md');
    } finally {
      await teardownTestProject(projectRoot);
    }
  });

  it('sets contextFileName to a custom output path', async () => {
    const { projectRoot } = await setupTestProject({
      '.ruler/AGENTS.md': 'Rule A',
    });
    try {
      const agent = new GeminiCliAgent();
      const customOutputPath = path.join('docs', 'GEMINI.md');

      await agent.applyRulerConfig('Rules', projectRoot, null, {
        outputPath: customOutputPath,
      });

      await expect(
        fs.readFile(path.join(projectRoot, customOutputPath), 'utf8'),
      ).resolves.toContain('Rules');

      const settings = await readGeminiSettings(projectRoot);
      expect(settings.contextFileName).toBe('docs/GEMINI.md');
    } finally {
      await teardownTestProject(projectRoot);
    }
  });

  it('preserves existing settings and adds/updates contextFileName', async () => {
    const { projectRoot } = await setupTestProject({
      '.ruler/AGENTS.md': 'Rule X',
      '.gemini/settings.json': JSON.stringify({
        someSetting: true,
        mcpServers: { existing: { url: 'http://example' } },
      }),
    });
    try {
      const agent = new GeminiCliAgent();
      await agent.applyRulerConfig('Rules', projectRoot, null);

      const settingsPath = path.join(projectRoot, '.gemini', 'settings.json');
      const settingsRaw = await fs.readFile(settingsPath, 'utf8');
      const settings = JSON.parse(settingsRaw);

      expect(settings.someSetting).toBe(true);
      // Ensure any existing mcpServers are preserved (merge happens in apply engine, this just shouldn’t remove)
      expect(settings.mcpServers).toEqual({
        existing: { url: 'http://example' },
      });
      // Ensure contextFileName is set to AGENTS.md
      expect(settings.contextFileName).toBe('AGENTS.md');
    } finally {
      await teardownTestProject(projectRoot);
    }
  });

  it('throws non-ENOENT settings read errors', async () => {
    const { projectRoot } = await setupTestProject({
      '.ruler/AGENTS.md': 'Rule E',
    });
    try {
      await fs.mkdir(path.join(projectRoot, '.gemini', 'settings.json'), {
        recursive: true,
      });

      const agent = new GeminiCliAgent();

      await expect(
        agent.applyRulerConfig('Rules', projectRoot, null),
      ).rejects.toMatchObject({
        code: expect.not.stringMatching(/^ENOENT$/),
      });
    } finally {
      await teardownTestProject(projectRoot);
    }
  });

  it('does not update mcpServers when MCP is disabled', async () => {
    const { projectRoot } = await setupTestProject({
      '.ruler/AGENTS.md': 'Rule M',
      '.gemini/settings.json': JSON.stringify({
        mcpServers: {
          existing: { command: 'old-command' },
        },
      }),
    });
    try {
      const agent = new GeminiCliAgent();

      await agent.applyRulerConfig(
        'Rules',
        projectRoot,
        {
          mcpServers: {
            incoming: { command: 'new-command' },
          },
        },
        { mcp: { enabled: false } },
      );

      const settings = await readGeminiSettings(projectRoot);
      expect(settings.contextFileName).toBe('AGENTS.md');
      expect(settings.mcpServers).toEqual({
        existing: { command: 'old-command' },
      });
    } finally {
      await teardownTestProject(projectRoot);
    }
  });

  it('merges MCP servers and strips type from object server entries', async () => {
    const { projectRoot } = await setupTestProject({
      '.ruler/AGENTS.md': 'Rule G',
      '.gemini/settings.json': JSON.stringify({
        theme: 'dark',
        mcpServers: {
          existing: { command: 'old-command', type: 'stdio' },
          shared: { command: 'old-shared', type: 'stdio' },
          primitive: 'keep-me',
        },
      }),
    });
    try {
      const agent = new GeminiCliAgent();

      await agent.applyRulerConfig(
        'Rules',
        projectRoot,
        {
          mcpServers: {
            shared: { url: 'https://example.com/mcp', type: 'http' },
            incoming: {
              command: 'new-command',
              args: ['--flag'],
              type: 'stdio',
            },
            primitive: false,
            nullish: null,
          },
        },
        { mcp: { strategy: 'merge' } },
      );

      const settings = await readGeminiSettings(projectRoot);
      expect(settings.theme).toBe('dark');
      expect(settings.mcpServers).toEqual({
        existing: { command: 'old-command' },
        shared: { url: 'https://example.com/mcp' },
        incoming: { command: 'new-command', args: ['--flag'] },
        primitive: false,
        nullish: null,
      });
    } finally {
      await teardownTestProject(projectRoot);
    }
  });

  it('overwrites MCP servers while preserving other settings', async () => {
    const { projectRoot } = await setupTestProject({
      '.ruler/AGENTS.md': 'Rule O',
      '.gemini/settings.json': JSON.stringify({
        telemetry: false,
        mcpServers: {
          existing: { command: 'old-command' },
        },
      }),
    });
    try {
      const agent = new GeminiCliAgent();

      await agent.applyRulerConfig(
        'Rules',
        projectRoot,
        {
          mcpServers: {
            incoming: { command: 'new-command', type: 'stdio' },
            primitive: 'unchanged',
          },
        },
        { mcp: { strategy: 'overwrite' } },
      );

      const settings = await readGeminiSettings(projectRoot);
      expect(settings.telemetry).toBe(false);
      expect(settings.contextFileName).toBe('AGENTS.md');
      expect(settings.mcpServers).toEqual({
        incoming: { command: 'new-command' },
        primitive: 'unchanged',
      });
    } finally {
      await teardownTestProject(projectRoot);
    }
  });
});
