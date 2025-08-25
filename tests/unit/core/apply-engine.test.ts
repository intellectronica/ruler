import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';

import {
  loadSingleConfiguration,
  selectAgentsToRun,
  applyConfigurationsToAgents,
  updateGitignore,
  RulerConfiguration,
} from '../../../src/core/apply-engine';
import { IAgent } from '../../../src/agents/IAgent';
import { ClaudeAgent } from '../../../src/agents/ClaudeAgent';
import { CopilotAgent } from '../../../src/agents/CopilotAgent';
import { LoadedConfig } from '../../../src/core/ConfigLoader';
import * as FileSystemUtils from '../../../src/core/FileSystemUtils';

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

  describe('selectAgentsToRun', () => {
    const mockAgents = [
      new MockAgent('Claude Code', 'claude'),
      new MockAgent('GitHub Copilot', 'copilot'),
      new MockAgent('Cursor', 'cursor'),
    ];

    it('should select agents based on CLI filters', () => {
      const config: LoadedConfig = {
        cliAgents: ['claude', 'cursor'],
        agentConfigs: {},
      };

      const result = selectAgentsToRun(mockAgents, config);

      expect(result).toHaveLength(2);
      expect(result.map((a) => a.getIdentifier())).toEqual([
        'claude',
        'cursor',
      ]);
    });

    it('should select agents based on default_agents when no CLI filters', () => {
      const config: LoadedConfig = {
        defaultAgents: ['copilot'],
        agentConfigs: {},
      };

      const result = selectAgentsToRun(mockAgents, config);

      expect(result).toHaveLength(1);
      expect(result[0].getIdentifier()).toBe('copilot');
    });

    it('should respect enabled flag in agent configs', () => {
      const config: LoadedConfig = {
        defaultAgents: ['claude', 'copilot'],
        agentConfigs: {
          claude: { enabled: false },
          copilot: { enabled: true },
        },
      };

      const result = selectAgentsToRun(mockAgents, config);

      expect(result).toHaveLength(1);
      expect(result[0].getIdentifier()).toBe('copilot');
    });

    it('should select all enabled agents when no filters or defaults', () => {
      const config: LoadedConfig = {
        agentConfigs: {
          claude: { enabled: false },
        },
      };

      const result = selectAgentsToRun(mockAgents, config);

      expect(result).toHaveLength(2);
      expect(result.map((a) => a.getIdentifier()).sort()).toEqual([
        'copilot',
        'cursor',
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
});
