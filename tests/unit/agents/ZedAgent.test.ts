import { promises as fs } from 'fs';
import * as path from 'path';
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

  it('should use context_servers as MCP key', () => {
    const agent = new ZedAgent();
    expect(agent.getMcpServerKey()).toBe('context_servers');
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

  it('creates .zed/settings.json with transformed MCP server configuration when file does not exist', async () => {
    const { projectRoot } = await setupTestProject({
      '.ruler/AGENTS.md': 'Test rules',
    });
    
    try {
      const agent = new ZedAgent();
      const rules = 'Test rules content';
      const mcpJson = {
        mcpServers: {
          'test-server': {
            type: 'stdio',
            command: 'echo',
            args: ['hello'],
            env: { TEST: 'value' },
          },
        },
      };

      await agent.applyRulerConfig(rules, projectRoot, mcpJson);

      // Check that .zed/settings.json was created with transformed MCP configuration
      const zedSettingsPath = path.join(projectRoot, '.zed', 'settings.json');
      const settingsContent = await fs.readFile(zedSettingsPath, 'utf8');
      const settings = JSON.parse(settingsContent);

      expect(settings.context_servers).toEqual({
        'test-server': {
          source: 'custom',
          command: 'echo',
          args: ['hello'],
          env: { TEST: 'value' },
        },
      });
    } finally {
      await teardownTestProject(projectRoot);
    }
  });

  it('merges transformed MCP server configuration into existing .zed/settings.json file', async () => {
    const { projectRoot } = await setupTestProject({
      '.ruler/AGENTS.md': 'Test rules',
    });
    
    try {
      // Create existing settings.json with some MCP servers
      const zedDir = path.join(projectRoot, '.zed');
      await fs.mkdir(zedDir, { recursive: true });
      const zedSettingsPath = path.join(zedDir, 'settings.json');
      const existingSettings = {
        theme: 'dark',
        context_servers: {
          'existing-server': {
            source: 'custom',
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
            type: 'stdio',
            command: 'pwd',
            env: { NODE_ENV: 'test' },
          },
        },
      };

      await agent.applyRulerConfig(rules, projectRoot, mcpJson);

      // Check that the settings.json was properly merged with transformed format
      const settingsContent = await fs.readFile(zedSettingsPath, 'utf8');
      const settings = JSON.parse(settingsContent);

      expect(settings.theme).toBe('dark'); // Existing setting preserved
      expect(settings.context_servers).toEqual({
        'existing-server': {
          source: 'custom',
          command: 'ls',
          args: ['-la'],
        },
        'new-server': {
          source: 'custom',
          command: 'pwd',
          env: { NODE_ENV: 'test' },
        },
      });
    } finally {
      await teardownTestProject(projectRoot);
    }
  });

  it('does not modify .zed/settings.json when no MCP config provided', async () => {
    const { projectRoot } = await setupTestProject({
      '.ruler/AGENTS.md': 'Test rules',
    });
    
    try {
      const agent = new ZedAgent();
      const rules = 'Test rules content';

      await agent.applyRulerConfig(rules, projectRoot, null);

      // Check that .zed/settings.json was not created
      const zedSettingsPath = path.join(projectRoot, '.zed', 'settings.json');
      await expect(fs.access(zedSettingsPath)).rejects.toThrow();
    } finally {
      await teardownTestProject(projectRoot);
    }
  });

  it('handles overwrite strategy for MCP servers with format transformation', async () => {
    const { projectRoot } = await setupTestProject({
      '.ruler/AGENTS.md': 'Test rules',
    });
    
    try {
      // Create existing settings.json with some MCP servers
      const zedDir = path.join(projectRoot, '.zed');
      await fs.mkdir(zedDir, { recursive: true });
      const zedSettingsPath = path.join(zedDir, 'settings.json');
      const existingSettings = {
        theme: 'dark',
        context_servers: {
          'existing-server': {
            source: 'custom',
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
            type: 'stdio',
            command: 'pwd',
            args: ['--version'],
            env: { DEBUG: '1' },
          },
        },
      };

      // Apply with overwrite strategy
      await agent.applyRulerConfig(rules, projectRoot, mcpJson, {
        mcp: { strategy: 'overwrite' },
      });

      // Check that the MCP servers were replaced with transformed format, but other settings preserved
      const settingsContent = await fs.readFile(zedSettingsPath, 'utf8');
      const settings = JSON.parse(settingsContent);

      expect(settings.theme).toBe('dark'); // Existing non-MCP setting preserved
      expect(settings.context_servers).toEqual({
        'new-server': {
          source: 'custom',
          command: 'pwd',
          args: ['--version'],
          env: { DEBUG: '1' },
        },
      }); // Only new servers with transformed format, existing MCP servers replaced
    } finally {
      await teardownTestProject(projectRoot);
    }
  });

  it('transforms MCP server configuration from ruler format to Zed format', () => {
    const agent = new ZedAgent();
    
    // Test transformation of a typical ruler MCP server configuration
    const rulerConfig = {
      type: 'stdio',
      command: 'node',
      args: ['/path/to/server.js'],
      env: { NODE_ENV: 'production', DEBUG: 'true' },
      someOtherField: 'preserved',
    };

    // Access the private method via any cast for testing
    const transformed = (agent as any).transformMcpServerForZed(rulerConfig);

    expect(transformed).toEqual({
      source: 'custom',
      command: 'node',
      args: ['/path/to/server.js'],
      env: { NODE_ENV: 'production', DEBUG: 'true' },
      someOtherField: 'preserved',
    });

    // Ensure "type" field is removed
    expect(transformed.type).toBeUndefined();
  });

  it('applies MCP configuration via full apply flow without external interference', async () => {
    const { projectRoot } = await setupTestProject({
      '.ruler/AGENTS.md': 'Test rules for apply flow',
      '.ruler/ruler.toml': `
[mcp_servers.test_server]
type = "stdio"
command = "test-cmd"
args = ["arg1", "arg2"]
env = { TEST_VAR = "test_value" }
      `,
    });

    try {
      // Import applyAllAgentConfigs to test the full flow
      const { applyAllAgentConfigs } = await import('../../../src/lib');
      
      // Apply configuration only to Zed agent through the full flow
      await applyAllAgentConfigs(
        projectRoot,
        ['zed'], // Only apply to Zed
        undefined, // Use default config path
        true, // MCP enabled
        undefined, // Default strategy
        undefined, // Default gitignore
        false, // Not verbose
        false, // Not dry run
        false, // Not local only
        false, // Not nested
        true, // Backup enabled
      );

      // Check the generated .zed/settings.json
      const zedSettingsPath = path.join(projectRoot, '.zed', 'settings.json');
      const settingsContent = await fs.readFile(zedSettingsPath, 'utf8');
      const settings = JSON.parse(settingsContent);

      // Verify the transformation was applied correctly
      expect(settings.context_servers).toBeDefined();
      expect(settings.context_servers.test_server).toBeDefined();
      
      const serverConfig = settings.context_servers.test_server;
      // Should have transformed format: no "type", has "source": "custom"
      expect(serverConfig.type).toBeUndefined();
      expect(serverConfig.source).toBe('custom');
      expect(serverConfig.command).toBe('test-cmd');
      expect(serverConfig.args).toEqual(['arg1', 'arg2']);
      expect(serverConfig.env).toEqual({ TEST_VAR: 'test_value' });
    } finally {
      await teardownTestProject(projectRoot);
    }
  });
});