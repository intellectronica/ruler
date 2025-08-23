import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ZedAgent } from '../../../src/agents/ZedAgent';
import { AgentsMdAgent } from '../../../src/agents/AgentsMdAgent';
import { setupTestProject, teardownTestProject } from '../../harness';

describe('ZedAgent', () => {
  it('should be defined', () => {
    expect(new ZedAgent()).toBeDefined();
  });

  it('should extend AgentsMdAgent', () => {
    const agent = new ZedAgent();
    expect(agent instanceof AgentsMdAgent).toBe(true);
  });

  it('should have the correct identifier', () => {
    const agent = new ZedAgent();
    expect(agent.getIdentifier()).toBe('zed');
  });

  it('should have the correct name', () => {
    const agent = new ZedAgent();
    expect(agent.getName()).toBe('Zed');
  });

  it('should use mcpServers as MCP key', () => {
    const agent = new ZedAgent();
    expect(agent.getMcpServerKey()).toBe('mcpServers');
  });

  it('writes AGENTS.md via base class', async () => {
    const { projectRoot } = await setupTestProject({
      '.ruler/AGENTS.md': 'Rule A',
    });
    try {
      const agent = new ZedAgent();
      const rules = 'Combined rules\n- Rule A';

      await agent.applyRulerConfig(rules, projectRoot, null);

      // AGENTS.md should be written at the repository root
      const agentsMdPath = path.join(projectRoot, 'AGENTS.md');
      await expect(fs.readFile(agentsMdPath, 'utf8')).resolves.toContain('Rule A');
    } finally {
      await teardownTestProject(projectRoot);
    }
  });

  it('creates ~/.zed/settings.json with MCP server configuration when file does not exist', async () => {
    const { projectRoot } = await setupTestProject({
      '.ruler/AGENTS.md': 'Test rules',
    });
    
    // Create a temporary home directory for this test
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), 'zed-agent-test-'));
    const originalHome = process.env.HOME;
    process.env.HOME = tempHome;
    
    try {
      const agent = new ZedAgent();
      const rules = 'Test rules content';
      const mcpJson = {
        mcpServers: {
          'test-server': {
            command: 'echo',
            args: ['hello'],
          },
        },
      };

      await agent.applyRulerConfig(rules, projectRoot, mcpJson);

      // Check that ~/.zed/settings.json was created with MCP configuration
      const zedSettingsPath = path.join(tempHome, '.zed', 'settings.json');
      const settingsContent = await fs.readFile(zedSettingsPath, 'utf8');
      const settings = JSON.parse(settingsContent);

      expect(settings.mcpServers).toEqual({
        'test-server': {
          command: 'echo',
          args: ['hello'],
        },
      });
    } finally {
      process.env.HOME = originalHome;
      await fs.rm(tempHome, { recursive: true, force: true });
      await teardownTestProject(projectRoot);
    }
  });

  it('merges MCP server configuration into existing ~/.zed/settings.json file', async () => {
    const { projectRoot } = await setupTestProject({
      '.ruler/AGENTS.md': 'Test rules',
    });
    
    // Create a temporary home directory for this test
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), 'zed-agent-test-'));
    const originalHome = process.env.HOME;
    process.env.HOME = tempHome;
    
    try {
      // Create existing settings.json with some MCP servers
      const zedDir = path.join(tempHome, '.zed');
      await fs.mkdir(zedDir, { recursive: true });
      const zedSettingsPath = path.join(zedDir, 'settings.json');
      const existingSettings = {
        theme: 'dark',
        mcpServers: {
          'existing-server': {
            command: 'ls',
            args: ['-la'],
          },
        },
      };
      await fs.writeFile(zedSettingsPath, JSON.stringify(existingSettings, null, 2));

      const agent = new ZedAgent();
      const rules = 'Test rules content';
      const mcpJson = {
        mcpServers: {
          'new-server': {
            command: 'pwd',
          },
        },
      };

      await agent.applyRulerConfig(rules, projectRoot, mcpJson);

      // Check that the settings.json was properly merged
      const settingsContent = await fs.readFile(zedSettingsPath, 'utf8');
      const settings = JSON.parse(settingsContent);

      expect(settings.theme).toBe('dark'); // Existing setting preserved
      expect(settings.mcpServers).toEqual({
        'existing-server': {
          command: 'ls',
          args: ['-la'],
        },
        'new-server': {
          command: 'pwd',
        },
      });
    } finally {
      process.env.HOME = originalHome;
      await fs.rm(tempHome, { recursive: true, force: true });
      await teardownTestProject(projectRoot);
    }
  });

  it('does not modify ~/.zed/settings.json when no MCP config provided', async () => {
    const { projectRoot } = await setupTestProject({
      '.ruler/AGENTS.md': 'Test rules',
    });
    
    // Create a temporary home directory for this test
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), 'zed-agent-test-'));
    const originalHome = process.env.HOME;
    process.env.HOME = tempHome;
    
    try {
      const agent = new ZedAgent();
      const rules = 'Test rules content';

      await agent.applyRulerConfig(rules, projectRoot, null);

      // Check that ~/.zed/settings.json was not created
      const zedSettingsPath = path.join(tempHome, '.zed', 'settings.json');
      await expect(fs.access(zedSettingsPath)).rejects.toThrow();
    } finally {
      process.env.HOME = originalHome;
      await fs.rm(tempHome, { recursive: true, force: true });
      await teardownTestProject(projectRoot);
    }
  });

  it('handles overwrite strategy for MCP servers', async () => {
    const { projectRoot } = await setupTestProject({
      '.ruler/AGENTS.md': 'Test rules',
    });
    
    // Create a temporary home directory for this test
    const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), 'zed-agent-test-'));
    const originalHome = process.env.HOME;
    process.env.HOME = tempHome;
    
    try {
      // Create existing settings.json with some MCP servers
      const zedDir = path.join(tempHome, '.zed');
      await fs.mkdir(zedDir, { recursive: true });
      const zedSettingsPath = path.join(zedDir, 'settings.json');
      const existingSettings = {
        theme: 'dark',
        mcpServers: {
          'existing-server': {
            command: 'ls',
            args: ['-la'],
          },
        },
      };
      await fs.writeFile(zedSettingsPath, JSON.stringify(existingSettings, null, 2));

      const agent = new ZedAgent();
      const rules = 'Test rules content';
      const mcpJson = {
        mcpServers: {
          'new-server': {
            command: 'pwd',
          },
        },
      };

      // Apply with overwrite strategy
      await agent.applyRulerConfig(rules, projectRoot, mcpJson, {
        mcp: { strategy: 'overwrite' },
      });

      // Check that the MCP servers were replaced, but other settings preserved
      const settingsContent = await fs.readFile(zedSettingsPath, 'utf8');
      const settings = JSON.parse(settingsContent);

      expect(settings.theme).toBe('dark'); // Existing non-MCP setting preserved
      expect(settings.mcpServers).toEqual({
        'new-server': {
          command: 'pwd',
        },
      }); // Only new servers, existing MCP servers replaced
    } finally {
      process.env.HOME = originalHome;
      await fs.rm(tempHome, { recursive: true, force: true });
      await teardownTestProject(projectRoot);
    }
  });
});