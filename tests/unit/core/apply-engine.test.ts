import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';

import {
  loadSingleConfiguration,
  loadNestedConfigurations,
  applyConfigurationsToAgents,
  updateGitignore,
  processHierarchicalConfigurations,
  RulerConfiguration,
  HierarchicalRulerConfiguration,
} from '../../../src/core/apply-engine';
import { IAgent } from '../../../src/agents/IAgent';
import { ClaudeAgent } from '../../../src/agents/ClaudeAgent';
import { CopilotAgent } from '../../../src/agents/CopilotAgent';
import { LoadedConfig } from '../../../src/core/ConfigLoader';
import * as FileSystemUtils from '../../../src/core/FileSystemUtils';
import * as Constants from '../../../src/constants';

// Mock agents for testing
class MockAgent implements IAgent {
  constructor(
    private name: string,
    private identifier: string,
  ) {}

  getName(): string {
    return this.name;
  }

  getIdentifier(): string {
    return this.identifier;
  }

  async applyRulerConfig(
    rules: string,
    projectRoot: string,
    mcpJson: Record<string, unknown> | null,
    agentConfig?: any,
  ): Promise<void> {
    // Mock implementation
  }

  getDefaultOutputPath(projectRoot: string): string {
    return `${projectRoot}/.${this.identifier}/config.json`;
  }

  getMcpServerKey?(): string {
    return 'mcpServers';
  }

  supportsMcpStdio?(): boolean {
    return true;
  }

  supportsMcpRemote?(): boolean {
    return true;
  }
}

describe('apply-engine', () => {
  let tmpDir: string;
  let rulerDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-apply-engine-'));
    rulerDir = path.join(tmpDir, '.ruler');
    await fs.mkdir(rulerDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('loadRulerConfiguration', () => {
    it('should load configuration with rules and MCP', async () => {
      // Setup test files
      const configContent = `default_agents = ["claude", "copilot"]`;
      await fs.writeFile(path.join(rulerDir, 'ruler.toml'), configContent);

      const rulesContent = '# Test rules\nUse TypeScript for all code.';
      await fs.writeFile(path.join(rulerDir, 'instructions.md'), rulesContent);

      const mcpContent = JSON.stringify({
        mcpServers: {
          test: {
            command: 'test-command',
            args: ['--test'],
          },
        },
      });
      await fs.writeFile(path.join(rulerDir, 'mcp.json'), mcpContent);

      const result = await loadSingleConfiguration(tmpDir, undefined, false);

      // Since hierarchical=false, result should be RulerConfiguration
      expect(result).toHaveProperty('config');
      expect(result).toHaveProperty('concatenatedRules');
      expect(result).toHaveProperty('rulerMcpJson');

      const configResult = result as RulerConfiguration;
      expect(configResult.config.defaultAgents).toEqual(['claude', 'copilot']);
      expect(configResult.concatenatedRules).toContain(
        'Use TypeScript for all code.',
      );
      expect(configResult.rulerMcpJson).toEqual({
        mcpServers: {
          test: {
            command: 'test-command',
            args: ['--test'],
            type: 'stdio',
          },
        },
      });
    });

    it('should handle missing MCP file gracefully', async () => {
      const configContent = `default_agents = ["claude"]`;
      await fs.writeFile(path.join(rulerDir, 'ruler.toml'), configContent);

      const rulesContent = '# Test rules';
      await fs.writeFile(path.join(rulerDir, 'instructions.md'), rulesContent);

      const result = await loadSingleConfiguration(tmpDir, undefined, false);

      // Since hierarchical=false, result should be RulerConfiguration
      expect(result).toHaveProperty('config');
      expect(result).toHaveProperty('concatenatedRules');
      expect(result).toHaveProperty('rulerMcpJson');

      const configResult = result as RulerConfiguration;
      expect(configResult.config.defaultAgents).toEqual(['claude']);
      expect(configResult.concatenatedRules).toContain('# Test rules');
      expect(configResult.rulerMcpJson).toBeNull();
    });

    it('should throw error when .ruler directory not found', async () => {
      const nonExistentDir = path.join(tmpDir, 'nonexistent');

      jest.spyOn(FileSystemUtils, 'findRulerDir').mockResolvedValue(null);

      try {
        await expect(
          loadSingleConfiguration(nonExistentDir, undefined, true),
        ).rejects.toThrow('.ruler directory not found');
      } finally {
        (FileSystemUtils.findRulerDir as jest.Mock).mockRestore();
      }
    });
  });

  describe('loadNestedConfigurations', () => {
    it('loads independent configs and forces nested flag through descendants', async () => {
      const moduleDir = path.join(tmpDir, 'module');
      const submoduleDir = path.join(moduleDir, 'submodule');

      const rootRulerDir = path.join(tmpDir, '.ruler');
      const moduleRulerDir = path.join(moduleDir, '.ruler');
      const submoduleRulerDir = path.join(submoduleDir, '.ruler');

      await fs.mkdir(rootRulerDir, { recursive: true });
      await fs.mkdir(moduleRulerDir, { recursive: true });
      await fs.mkdir(submoduleRulerDir, { recursive: true });

      await fs.writeFile(
        path.join(rootRulerDir, 'AGENTS.md'),
        '# Root Instructions',
      );
      await fs.writeFile(
        path.join(moduleRulerDir, 'AGENTS.md'),
        '# Module Instructions',
      );
      await fs.writeFile(
        path.join(submoduleRulerDir, 'AGENTS.md'),
        '# Submodule Instructions',
      );

      await fs.writeFile(
        path.join(rootRulerDir, 'ruler.toml'),
        `default_agents = ["root-agent"]
nested = true

[agents]
[agents.claude]
enabled = true

[mcp]
enabled = true
`,
      );

      await fs.writeFile(
        path.join(moduleRulerDir, 'ruler.toml'),
        `default_agents = ["module-agent"]

[agents]
[agents.copilot]
enabled = false

[mcp]
enabled = false
`,
      );

      await fs.writeFile(
        path.join(submoduleRulerDir, 'ruler.toml'),
        `default_agents = ["submodule-agent"]
nested = false

[agents]
[agents.windsurf]
enabled = true

[mcp]
merge_strategy = "overwrite"
`,
      );

      const warnSpy = jest
        .spyOn(Constants, 'logWarn')
        .mockImplementation(() => {});

      try {
        const configs = await loadNestedConfigurations(
          tmpDir,
          undefined,
          true, // localOnly: true to avoid picking up global config
          true, // resolvedNested: true to force nested mode
        );

        expect(configs).toHaveLength(3);

        const rootConfig = configs.find((c) => c.rulerDir === rootRulerDir);
        const moduleConfig = configs.find((c) => c.rulerDir === moduleRulerDir);
        const submoduleConfig = configs.find(
          (c) => c.rulerDir === submoduleRulerDir,
        );

        expect(rootConfig).toBeDefined();
        expect(moduleConfig).toBeDefined();
        expect(submoduleConfig).toBeDefined();

        if (!rootConfig || !moduleConfig || !submoduleConfig) {
          throw new Error('Expected hierarchical configs for all directories');
        }

        expect(rootConfig.config).not.toBe(moduleConfig.config);
        expect(rootConfig.config).not.toBe(submoduleConfig.config);
        expect(moduleConfig.config).not.toBe(submoduleConfig.config);

        expect(rootConfig.config.defaultAgents).toEqual(['root-agent']);
        expect(moduleConfig.config.defaultAgents).toEqual(['module-agent']);
        expect(submoduleConfig.config.defaultAgents).toEqual([
          'submodule-agent',
        ]);

        expect(Object.keys(rootConfig.config.agentConfigs)).toEqual(['claude']);
        expect(rootConfig.config.agentConfigs.claude?.enabled).toBe(true);

        expect(Object.keys(moduleConfig.config.agentConfigs)).toEqual([
          'copilot',
        ]);
        expect(moduleConfig.config.agentConfigs.copilot?.enabled).toBe(false);

        expect(Object.keys(submoduleConfig.config.agentConfigs)).toEqual([
          'windsurf',
        ]);
        expect(submoduleConfig.config.agentConfigs.windsurf?.enabled).toBe(
          true,
        );

        expect(rootConfig.config.mcp?.enabled).toBe(true);
        expect(moduleConfig.config.mcp?.enabled).toBe(false);
        expect(submoduleConfig.config.mcp?.strategy).toBe('overwrite');

        expect(rootConfig.config.nested).toBe(true);
        expect(moduleConfig.config.nested).toBe(true);
        expect(submoduleConfig.config.nested).toBe(true);

        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('nested = false'),
        );
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining(path.join(submoduleRulerDir, 'ruler.toml')),
        );
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('propagates unified MCP bundles and preserves agent-level MCP flags per directory', async () => {
      const moduleDir = path.join(tmpDir, 'module');
      const submoduleDir = path.join(moduleDir, 'submodule');

      const rootRulerDir = path.join(tmpDir, '.ruler');
      const moduleRulerDir = path.join(moduleDir, '.ruler');
      const submoduleRulerDir = path.join(submoduleDir, '.ruler');

      await fs.mkdir(rootRulerDir, { recursive: true });
      await fs.mkdir(moduleRulerDir, { recursive: true });
      await fs.mkdir(submoduleRulerDir, { recursive: true });

      await fs.writeFile(
        path.join(rootRulerDir, 'AGENTS.md'),
        '# Root Instructions',
      );
      await fs.writeFile(
        path.join(moduleRulerDir, 'AGENTS.md'),
        '# Module Instructions',
      );
      await fs.writeFile(
        path.join(submoduleRulerDir, 'AGENTS.md'),
        '# Submodule Instructions',
      );

      await fs.writeFile(
        path.join(rootRulerDir, 'ruler.toml'),
        `default_agents = ["claude", "copilot"]

[agents]
[agents.claude]
enabled = true

[agents.claude.mcp]
enabled = true

[agents.copilot]
enabled = true

[agents.copilot.mcp]
enabled = false

[mcp_servers.root-stdio]
command = "root-cmd"
args = ["--root"]
`,
      );

      await fs.writeFile(
        path.join(moduleRulerDir, 'ruler.toml'),
        `default_agents = ["copilot", "windsurf"]

[agents]
[agents.copilot]
enabled = true

[agents.copilot.mcp]
enabled = true

[agents.windsurf]
enabled = false

[agents.windsurf.mcp]
enabled = false

[mcp_servers.module-remote]
url = "https://module.example"
`,
      );

      await fs.writeFile(
        path.join(submoduleRulerDir, 'ruler.toml'),
        `default_agents = ["windsurf"]

[agents]
[agents.windsurf]
enabled = true

[agents.windsurf.mcp]
enabled = true

[mcp_servers.sub-stdio]
command = "sub-cmd"
`,
      );

      const configs = await loadNestedConfigurations(
        tmpDir,
        undefined,
        false,
        true,
      );

      const rootConfig = configs.find((c) => c.rulerDir === rootRulerDir);
      const moduleConfig = configs.find((c) => c.rulerDir === moduleRulerDir);
      const submoduleConfig = configs.find(
        (c) => c.rulerDir === submoduleRulerDir,
      );

      expect(rootConfig?.rulerMcpJson).toEqual({
        mcpServers: {
          'root-stdio': expect.objectContaining({
            command: 'root-cmd',
            args: ['--root'],
            type: 'stdio',
          }),
        },
      });

      expect(moduleConfig?.rulerMcpJson).toEqual({
        mcpServers: {
          'module-remote': expect.objectContaining({
            url: 'https://module.example',
            type: 'remote',
          }),
        },
      });

      expect(submoduleConfig?.rulerMcpJson).toEqual({
        mcpServers: {
          'sub-stdio': expect.objectContaining({
            command: 'sub-cmd',
            type: 'stdio',
          }),
        },
      });

      expect(rootConfig?.config.agentConfigs.claude?.mcp?.enabled).toBe(true);
      expect(rootConfig?.config.agentConfigs.copilot?.mcp?.enabled).toBe(false);
      expect(moduleConfig?.config.agentConfigs.copilot?.mcp?.enabled).toBe(
        true,
      );
      expect(moduleConfig?.config.agentConfigs.windsurf?.mcp?.enabled).toBe(
        false,
      );
      expect(submoduleConfig?.config.agentConfigs.windsurf?.mcp?.enabled).toBe(
        true,
      );
    });
  });

  describe('processHierarchicalConfigurations', () => {
    it('passes each directory root and MCP bundle through to agent applications', async () => {
      const rootRulerDir = path.join(tmpDir, '.ruler');
      const nestedRulerDir = path.join(tmpDir, 'nested', '.ruler');
      await fs.mkdir(rootRulerDir, { recursive: true });
      await fs.mkdir(nestedRulerDir, { recursive: true });

      const records: Array<{
        projectRoot: string;
        mcp: Record<string, unknown> | null;
      }> = [];

      class RecordingAgent extends MockAgent {
        async applyRulerConfig(
          rules: string,
          projectRoot: string,
          mcpJson: Record<string, unknown> | null,
        ): Promise<void> {
          records.push({ projectRoot, mcp: mcpJson });
        }
      }

      const agent = new RecordingAgent('Recording Agent', 'recording');

      const configurations: HierarchicalRulerConfiguration[] = [
        {
          rulerDir: rootRulerDir,
          config: { agentConfigs: { recording: {} } } as LoadedConfig,
          concatenatedRules: '# Root',
          rulerMcpJson: { mcpServers: { root: { command: 'root' } } },
        },
        {
          rulerDir: nestedRulerDir,
          config: { agentConfigs: { recording: {} } } as LoadedConfig,
          concatenatedRules: '# Nested',
          rulerMcpJson: {
            mcpServers: { nested: { url: 'https://nested.example' } },
          },
        },
      ];

      await processHierarchicalConfigurations(
        [agent],
        configurations,
        false,
        false,
        true,
        undefined,
        false,
      );

      expect(records).toEqual([
        {
          projectRoot: path.dirname(rootRulerDir),
          mcp: { mcpServers: { root: { command: 'root' } } },
        },
        {
          projectRoot: path.dirname(nestedRulerDir),
          mcp: { mcpServers: { nested: { url: 'https://nested.example' } } },
        },
      ]);
    });
  });

  describe('applyConfigurationsToAgents', () => {
    it('should apply configurations to all agents and return generated paths', async () => {
      const mockAgents = [new MockAgent('Claude Code', 'claude')];
      const config: LoadedConfig = { agentConfigs: {} };
      const rules = '# Test rules';
      const mcpJson = null;

      const result = await applyConfigurationsToAgents(
        mockAgents,
        rules,
        mcpJson,
        config,
        tmpDir,
        false,
        false,
        true,
        undefined,
      );

      expect(result).toContain(`${tmpDir}/.claude/config.json`);
    });

    it('should handle dry run mode', async () => {
      const mockAgents = [new MockAgent('Claude Code', 'claude')];
      const config: LoadedConfig = { agentConfigs: {} };
      const rules = '# Test rules';
      const mcpJson = null;

      const result = await applyConfigurationsToAgents(
        mockAgents,
        rules,
        mcpJson,
        config,
        tmpDir,
        false,
        true, // dry run
        true,
        undefined,
      );

      expect(result).toContain(`${tmpDir}/.claude/config.json`);
    });
  });

  describe('updateGitignore', () => {
    it('should update gitignore when enabled', async () => {
      const config: LoadedConfig = { agentConfigs: {} };
      const generatedPaths = ['.claude/config.json', '.copilot/settings.json'];

      await updateGitignore(tmpDir, generatedPaths, config, true, false);

      const gitignoreContent = await fs.readFile(
        path.join(tmpDir, '.gitignore'),
        'utf8',
      );
      expect(gitignoreContent).toContain('.claude/config.json');
      expect(gitignoreContent).toContain('.copilot/settings.json');
    });

    it('should not update gitignore when disabled', async () => {
      const config: LoadedConfig = { agentConfigs: {} };
      const generatedPaths = ['.claude/config.json'];

      await updateGitignore(tmpDir, generatedPaths, config, false, false);

      const gitignoreExists = await fs
        .access(path.join(tmpDir, '.gitignore'))
        .then(() => true)
        .catch(() => false);

      expect(gitignoreExists).toBe(false);
    });

    it('should handle dry run mode', async () => {
      const config: LoadedConfig = { agentConfigs: {} };
      const generatedPaths = ['.claude/config.json'];

      await updateGitignore(tmpDir, generatedPaths, config, true, true);

      const gitignoreExists = await fs
        .access(path.join(tmpDir, '.gitignore'))
        .then(() => true)
        .catch(() => false);

      expect(gitignoreExists).toBe(false);
    });
  });

  describe('dry-run logging patterns', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should use [ruler:dry-run] prefix when dryRun is true', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const mockAgents = [new MockAgent('Claude Code', 'claude')];
      const config: LoadedConfig = { agentConfigs: {} };
      const rules = '# Test rules';
      const mcpJson = null;

      await applyConfigurationsToAgents(
        mockAgents,
        rules,
        mcpJson,
        config,
        tmpDir,
        false,
        true, // dryRun=true
        true,
        undefined,
      );

      const logCalls = consoleLogSpy.mock.calls.flat();
      const hasRulerDryRunPrefix = logCalls.some(
        (call) => typeof call === 'string' && call.includes('[ruler:dry-run]'),
      );

      expect(hasRulerDryRunPrefix).toBe(true);
      consoleLogSpy.mockRestore();
    });

    it('should use [ruler] prefix when dryRun is false', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const mockAgents = [new MockAgent('Claude Code', 'claude')];
      const config: LoadedConfig = { agentConfigs: {} };
      const rules = '# Test rules';
      const mcpJson = null;

      await applyConfigurationsToAgents(
        mockAgents,
        rules,
        mcpJson,
        config,
        tmpDir,
        false,
        false, // dryRun=false
        true,
        undefined,
      );

      const logCalls = consoleLogSpy.mock.calls.flat();
      const hasRulerPrefix = logCalls.some(
        (call) =>
          typeof call === 'string' &&
          call.includes('[ruler]') &&
          !call.includes('[ruler:dry-run]'),
      );

      expect(hasRulerPrefix).toBe(true);
      consoleLogSpy.mockRestore();
    });
  });

  describe('MCP type transformations', () => {
    it('should transform remote type to streamable-http for Kilo Code', async () => {
      const kilocodeDir = path.join(tmpDir, '.kilocode');
      await fs.mkdir(kilocodeDir, { recursive: true });

      const config: LoadedConfig = {
        agentConfigs: {
          kilocode: {
            enabled: true,
            mcp: { enabled: true },
          },
        },
      };

      const rules = '# Test rules';
      const mcpJson = {
        mcpServers: {
          'context7': {
            url: 'https://mcp.context7.com/mcp',
            type: 'remote',
            headers: {
              Authorization: 'Bearer CTX123456',
            },
          },
        },
      };

      const kilocodeAgent = new MockAgent('Kilo Code', 'kilocode');

      await applyConfigurationsToAgents(
        [kilocodeAgent],
        rules,
        mcpJson,
        config,
        tmpDir,
        false,
        false,
        true,
        undefined,
        false,
      );

      const mcpPath = path.join(kilocodeDir, 'mcp.json');
      const mcpContent = JSON.parse(await fs.readFile(mcpPath, 'utf8'));

      expect(mcpContent.mcpServers.context7.type).toBe('streamable-http');
      expect(mcpContent.mcpServers.context7.url).toBe(
        'https://mcp.context7.com/mcp',
      );
      expect(mcpContent.mcpServers.context7.headers.Authorization).toBe(
        'Bearer CTX123456',
      );
    });

    it('should preserve non-remote types for Kilo Code', async () => {
      const kilocodeDir = path.join(tmpDir, '.kilocode');
      await fs.mkdir(kilocodeDir, { recursive: true });

      const config: LoadedConfig = {
        agentConfigs: {
          kilocode: {
            enabled: true,
            mcp: { enabled: true },
          },
        },
      };

      const rules = '# Test rules';
      const mcpJson = {
        mcpServers: {
          'local-stdio': {
            command: 'node',
            args: ['server.js'],
            type: 'stdio',
          },
        },
      };

      const kilocodeAgent = new MockAgent('Kilo Code', 'kilocode');

      await applyConfigurationsToAgents(
        [kilocodeAgent],
        rules,
        mcpJson,
        config,
        tmpDir,
        false,
        false,
        true,
        undefined,
        false,
      );

      const mcpPath = path.join(kilocodeDir, 'mcp.json');
      const mcpContent = JSON.parse(await fs.readFile(mcpPath, 'utf8'));

      expect(mcpContent.mcpServers['local-stdio'].type).toBe('stdio');
      expect(mcpContent.mcpServers['local-stdio'].command).toBe('node');
    });

    it('should transform remote type to http for Claude Code', async () => {
      const config: LoadedConfig = {
        agentConfigs: {
          claude: {
            enabled: true,
            mcp: { enabled: true },
          },
        },
      };

      const rules = '# Test rules';
      const mcpJson = {
        mcpServers: {
          'remote-server': {
            url: 'https://api.example.com/mcp',
            type: 'remote',
          },
        },
      };

      const claudeAgent = new ClaudeAgent();

      await applyConfigurationsToAgents(
        [claudeAgent],
        rules,
        mcpJson,
        config,
        tmpDir,
        false,
        false,
        true,
        undefined,
        false,
      );

      const mcpPath = path.join(tmpDir, '.mcp.json');
      const mcpContent = JSON.parse(await fs.readFile(mcpPath, 'utf8'));

      expect(mcpContent.mcpServers['remote-server'].type).toBe('http');
    });

    it('should transform remote type to sse for SSE endpoints in Claude Code', async () => {
      const config: LoadedConfig = {
        agentConfigs: {
          claude: {
            enabled: true,
            mcp: { enabled: true },
          },
        },
      };

      const rules = '# Test rules';
      const mcpJson = {
        mcpServers: {
          'sse-server': {
            url: 'https://api.example.com/sse/events',
            type: 'remote',
          },
        },
      };

      const claudeAgent = new ClaudeAgent();

      await applyConfigurationsToAgents(
        [claudeAgent],
        rules,
        mcpJson,
        config,
        tmpDir,
        false,
        false,
        true,
        undefined,
        false,
      );

      const mcpPath = path.join(tmpDir, '.mcp.json');
      const mcpContent = JSON.parse(await fs.readFile(mcpPath, 'utf8'));

      expect(mcpContent.mcpServers['sse-server'].type).toBe('sse');
    });
  });
});
