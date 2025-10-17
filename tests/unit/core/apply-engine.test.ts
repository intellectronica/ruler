import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';

import {
  loadSingleConfiguration,
  loadNestedConfigurations,
  applyConfigurationsToAgents,
  updateGitignore,
  RulerConfiguration,
  HierarchicalRulerConfiguration,
} from '../../../src/core/apply-engine';
import { IAgent } from '../../../src/agents/IAgent';
import { ClaudeAgent } from '../../../src/agents/ClaudeAgent';
import { CopilotAgent } from '../../../src/agents/CopilotAgent';
import { LoadedConfig } from '../../../src/core/ConfigLoader';
import * as FileSystemUtils from '../../../src/core/FileSystemUtils';
import { logWarn } from '../../../src/constants';

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

  describe('loadNestedConfigurations', () => {
    let projectRoot: string;

    beforeEach(async () => {
      projectRoot = await fs.mkdtemp(
        path.join(os.tmpdir(), 'ruler-nested-config-'),
      );
    });

    afterEach(async () => {
      await fs.rm(projectRoot, { recursive: true, force: true });
    });

    it('should load configurations for nested .ruler directories', async () => {
      // Create nested structure: root/.ruler, root/module/.ruler, root/module/submodule/.ruler
      const rootRulerDir = path.join(projectRoot, '.ruler');
      const moduleDir = path.join(projectRoot, 'module');
      const moduleRulerDir = path.join(moduleDir, '.ruler');
      const submoduleDir = path.join(moduleDir, 'submodule');
      const submoduleRulerDir = path.join(submoduleDir, '.ruler');

      await fs.mkdir(rootRulerDir, { recursive: true });
      await fs.mkdir(moduleRulerDir, { recursive: true });
      await fs.mkdir(submoduleRulerDir, { recursive: true });

      // Create TOML configs
      await fs.writeFile(
        path.join(rootRulerDir, 'ruler.toml'),
        'default_agents = ["claude"]\nnested = true',
      );
      await fs.writeFile(
        path.join(moduleRulerDir, 'ruler.toml'),
        '[agents.claude]\nenabled = false',
      );
      await fs.writeFile(
        path.join(submoduleRulerDir, 'ruler.toml'),
        'default_agents = ["copilot"]',
      );

      // Create markdown files
      await fs.writeFile(
        path.join(rootRulerDir, 'AGENTS.md'),
        '# Root Rules',
      );
      await fs.writeFile(
        path.join(moduleRulerDir, 'AGENTS.md'),
        '# Module Rules',
      );
      await fs.writeFile(
        path.join(submoduleRulerDir, 'AGENTS.md'),
        '# Submodule Rules',
      );

      const configs = await loadNestedConfigurations(
        projectRoot,
        undefined,
        false,
        true, // nested=true
      );

      // Should return 3 configurations
      expect(configs).toHaveLength(3);

      // Verify each configuration has the correct directory
      const rootConfig = configs.find((c) => c.rulerDir === rootRulerDir);
      const moduleConfig = configs.find((c) => c.rulerDir === moduleRulerDir);
      const submoduleConfig = configs.find(
        (c) => c.rulerDir === submoduleRulerDir,
      );

      expect(rootConfig).toBeDefined();
      expect(moduleConfig).toBeDefined();
      expect(submoduleConfig).toBeDefined();

      // Verify each has correct rules
      expect(rootConfig!.concatenatedRules).toContain('Root Rules');
      expect(moduleConfig!.concatenatedRules).toContain('Module Rules');
      expect(submoduleConfig!.concatenatedRules).toContain('Submodule Rules');
    });

    it('should force nested=true for all descendant configs when parent enables it', async () => {
      const rootRulerDir = path.join(projectRoot, '.ruler');
      const moduleDir = path.join(projectRoot, 'module');
      const moduleRulerDir = path.join(moduleDir, '.ruler');

      await fs.mkdir(rootRulerDir, { recursive: true });
      await fs.mkdir(moduleRulerDir, { recursive: true });

      await fs.writeFile(
        path.join(rootRulerDir, 'ruler.toml'),
        'nested = true',
      );
      await fs.writeFile(
        path.join(moduleRulerDir, 'ruler.toml'),
        'nested = false',
      );

      await fs.writeFile(
        path.join(rootRulerDir, 'AGENTS.md'),
        '# Root Rules',
      );
      await fs.writeFile(
        path.join(moduleRulerDir, 'AGENTS.md'),
        '# Module Rules',
      );

      const configs = await loadNestedConfigurations(
        projectRoot,
        undefined,
        false,
        true, // parent decision: nested=true
      );

      // All configs should have nested=true forced
      expect(configs).toHaveLength(2);
      configs.forEach((config) => {
        expect(config.config.nested).toBe(true);
      });
    });

    it('should warn when child TOML sets nested=false but parent enabled it', async () => {
      const rootRulerDir = path.join(projectRoot, '.ruler');
      const moduleDir = path.join(projectRoot, 'module');
      const moduleRulerDir = path.join(moduleDir, '.ruler');

      await fs.mkdir(rootRulerDir, { recursive: true });
      await fs.mkdir(moduleRulerDir, { recursive: true });

      await fs.writeFile(
        path.join(rootRulerDir, 'ruler.toml'),
        'nested = true',
      );
      await fs.writeFile(
        path.join(moduleRulerDir, 'ruler.toml'),
        'nested = false',
      );

      await fs.writeFile(
        path.join(rootRulerDir, 'AGENTS.md'),
        '# Root Rules',
      );
      await fs.writeFile(
        path.join(moduleRulerDir, 'AGENTS.md'),
        '# Module Rules',
      );

      // Spy on console.warn to capture the warning
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await loadNestedConfigurations(
        projectRoot,
        undefined,
        false,
        true, // parent decision: nested=true
      );

      // Should have called console.warn with a message about the module
      const warnCalls = consoleWarnSpy.mock.calls.flat();
      const hasNestedWarning = warnCalls.some(
        (call) =>
          typeof call === 'string' &&
          call.includes('nested = false') &&
          call.includes(moduleRulerDir),
      );
      expect(hasNestedWarning).toBe(true);

      consoleWarnSpy.mockRestore();
    });

    it('should inherit unspecified settings from ancestor configs', async () => {
      const rootRulerDir = path.join(projectRoot, '.ruler');
      const moduleDir = path.join(projectRoot, 'module');
      const moduleRulerDir = path.join(moduleDir, '.ruler');

      await fs.mkdir(rootRulerDir, { recursive: true });
      await fs.mkdir(moduleRulerDir, { recursive: true });

      // Root config sets default_agents and global MCP
      await fs.writeFile(
        path.join(rootRulerDir, 'ruler.toml'),
        `default_agents = ["claude", "copilot"]
nested = true
[mcp]
enabled = true
merge_strategy = "merge"
[agents.claude]
enabled = true`,
      );

      // Module config only overrides one agent setting
      await fs.writeFile(
        path.join(moduleRulerDir, 'ruler.toml'),
        `[agents.copilot]
enabled = false`,
      );

      await fs.writeFile(
        path.join(rootRulerDir, 'AGENTS.md'),
        '# Root Rules',
      );
      await fs.writeFile(
        path.join(moduleRulerDir, 'AGENTS.md'),
        '# Module Rules',
      );

      const configs = await loadNestedConfigurations(
        projectRoot,
        undefined,
        false,
        true,
      );

      const rootConfig = configs.find((c) => c.rulerDir === rootRulerDir);
      const moduleConfig = configs.find((c) => c.rulerDir === moduleRulerDir);

      // Root config should have its own settings
      expect(rootConfig!.config.defaultAgents).toEqual(['claude', 'copilot']);
      expect(rootConfig!.config.mcp?.enabled).toBe(true);
      expect(rootConfig!.config.mcp?.strategy).toBe('merge');
      expect(rootConfig!.config.agentConfigs.claude?.enabled).toBe(true);

      // Module config should inherit unspecified settings
      expect(moduleConfig!.config.defaultAgents).toEqual(['claude', 'copilot']);
      expect(moduleConfig!.config.mcp?.enabled).toBe(true);
      expect(moduleConfig!.config.mcp?.strategy).toBe('merge');
      expect(moduleConfig!.config.agentConfigs.claude?.enabled).toBe(true);
      // But override the copilot setting
      expect(moduleConfig!.config.agentConfigs.copilot?.enabled).toBe(false);
    });

    it('should deep clone configs to avoid shared references', async () => {
      const rootRulerDir = path.join(projectRoot, '.ruler');
      const moduleDir = path.join(projectRoot, 'module');
      const moduleRulerDir = path.join(moduleDir, '.ruler');

      await fs.mkdir(rootRulerDir, { recursive: true });
      await fs.mkdir(moduleRulerDir, { recursive: true });

      await fs.writeFile(
        path.join(rootRulerDir, 'ruler.toml'),
        `default_agents = ["claude"]
[agents.claude]
enabled = true`,
      );

      await fs.writeFile(
        path.join(rootRulerDir, 'AGENTS.md'),
        '# Root Rules',
      );
      await fs.writeFile(
        path.join(moduleRulerDir, 'AGENTS.md'),
        '# Module Rules',
      );

      const configs = await loadNestedConfigurations(
        projectRoot,
        undefined,
        false,
        true,
      );

      const rootConfig = configs.find((c) => c.rulerDir === rootRulerDir);
      const moduleConfig = configs.find((c) => c.rulerDir === moduleRulerDir);

      // Configs should not share the same object references
      expect(rootConfig!.config).not.toBe(moduleConfig!.config);
      expect(rootConfig!.config.agentConfigs).not.toBe(
        moduleConfig!.config.agentConfigs,
      );

      // Modifying one should not affect the other
      rootConfig!.config.nested = false;
      expect(moduleConfig!.config.nested).toBe(true);
    });
  });
});
