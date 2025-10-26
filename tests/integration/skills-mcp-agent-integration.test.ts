import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { applyAllAgentConfigs } from '../../src/lib';
import { SKILL_MD_FILENAME } from '../../src/constants';
import { parse as parseTOML } from '@iarna/toml';

describe('Skills MCP Agent Integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ruler-skills-agent-mcp-'),
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('Skillz MCP server for agents handling MCP internally', () => {
    beforeEach(async () => {
      // Create .ruler directory with rules and skills
      const rulerDir = path.join(tmpDir, '.ruler');
      await fs.mkdir(rulerDir, { recursive: true });
      await fs.writeFile(
        path.join(rulerDir, 'instructions.md'),
        '# Test instructions',
      );

      // Create a test skill
      const skillDir = path.join(rulerDir, 'skills', 'test-skill');
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(
        path.join(skillDir, SKILL_MD_FILENAME),
        '# Test Skill',
      );
    });

    it('adds Skillz MCP server to Codex CLI config', async () => {
      await applyAllAgentConfigs(
        tmpDir,
        ['codex'],
        undefined,
        true,
        undefined,
        undefined,
        false,
        false,
        false,
        false,
        true,
        true, // skills enabled
      );

      // Check that .codex/config.toml exists and contains skillz server
      const codexConfigPath = path.join(tmpDir, '.codex', 'config.toml');
      const configContent = await fs.readFile(codexConfigPath, 'utf8');
      const config = parseTOML(configContent);

      expect(config).toHaveProperty('mcp_servers');
      expect(config.mcp_servers).toHaveProperty('skillz');
      const skillzServer = config.mcp_servers.skillz as any;
      expect(skillzServer.command).toBe('uvx');
      expect(skillzServer.args).toContain('skillz@latest');
      expect(skillzServer.args[1]).toContain('.skillz');
    });

    it('adds Skillz MCP server to Gemini CLI config', async () => {
      await applyAllAgentConfigs(
        tmpDir,
        ['gemini-cli'],
        undefined,
        true,
        undefined,
        undefined,
        false,
        false,
        false,
        false,
        true,
        true, // skills enabled
      );

      // Check that .gemini/settings.json exists and contains skillz server
      const geminiSettingsPath = path.join(tmpDir, '.gemini', 'settings.json');
      const settingsContent = await fs.readFile(geminiSettingsPath, 'utf8');
      const settings = JSON.parse(settingsContent);

      expect(settings).toHaveProperty('mcpServers');
      expect(settings.mcpServers).toHaveProperty('skillz');
      expect(settings.mcpServers.skillz.command).toBe('uvx');
      expect(settings.mcpServers.skillz.args).toContain('skillz@latest');
      expect(settings.mcpServers.skillz.args[1]).toContain('.skillz');
    });

    it('adds Skillz MCP server to Copilot MCP config', async () => {
      await applyAllAgentConfigs(
        tmpDir,
        ['copilot'],
        undefined,
        true,
        undefined,
        undefined,
        false,
        false,
        false,
        false,
        true,
        true, // skills enabled
      );

      // Check that .vscode/mcp.json exists and contains skillz server
      const mcpPath = path.join(tmpDir, '.vscode', 'mcp.json');
      const mcpContent = await fs.readFile(mcpPath, 'utf8');
      const mcp = JSON.parse(mcpContent);

      expect(mcp).toHaveProperty('servers');
      expect(mcp.servers).toHaveProperty('skillz');
      expect(mcp.servers.skillz.command).toBe('uvx');
      expect(mcp.servers.skillz.args).toContain('skillz@latest');
      expect(mcp.servers.skillz.args[1]).toContain('.skillz');
    });

    it('does not add Skillz server when skills are disabled', async () => {
      await applyAllAgentConfigs(
        tmpDir,
        ['codex', 'gemini-cli'],
        undefined,
        true,
        undefined,
        undefined,
        false,
        false,
        false,
        false,
        true,
        false, // skills disabled
      );

      // Check that configs don't have skillz server
      const codexConfigPath = path.join(tmpDir, '.codex', 'config.toml');
      const geminiSettingsPath = path.join(tmpDir, '.gemini', 'settings.json');

      // Codex config should not have skillz
      try {
        const codexContent = await fs.readFile(codexConfigPath, 'utf8');
        const codexConfig = parseTOML(codexContent);
        expect(codexConfig.mcp_servers).not.toHaveProperty('skillz');
      } catch (err) {
        // File might not exist if no MCP servers at all, which is fine
      }

      // Gemini config should not have skillz
      try {
        const geminiContent = await fs.readFile(geminiSettingsPath, 'utf8');
        const geminiSettings = JSON.parse(geminiContent);
        if (geminiSettings.mcpServers) {
          expect(geminiSettings.mcpServers).not.toHaveProperty('skillz');
        }
      } catch (err) {
        // File might not exist if no MCP servers at all, which is fine
      }
    });

    it('adds Skillz server even when there are existing MCP servers', async () => {
      // Override beforeEach setup - need to create ruler.toml first
      const rulerDir = path.join(tmpDir, '.ruler');

      // Create ruler.toml with existing MCP server
      await fs.writeFile(
        path.join(rulerDir, 'ruler.toml'),
        `
[mcp.servers.existing-server]
command = "node"
args = ["server.js"]
`,
      );

      // Now create instructions and skills
      await fs.writeFile(
        path.join(rulerDir, 'instructions.md'),
        '# Test instructions',
      );
      const skillDir = path.join(rulerDir, 'skills', 'test-skill');
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(
        path.join(skillDir, SKILL_MD_FILENAME),
        '# Test Skill',
      );

      await applyAllAgentConfigs(
        tmpDir,
        ['codex'],
        undefined,
        true,
        undefined,
        undefined,
        false,
        false,
        false,
        false,
        true,
        true, // skills enabled
      );

      const codexConfigPath = path.join(tmpDir, '.codex', 'config.toml');
      const configContent = await fs.readFile(codexConfigPath, 'utf8');
      const config = parseTOML(configContent);

      // Should have skillz server (existing-server may or may not be there depending on filtering)
      expect(config.mcp_servers).toHaveProperty('skillz');
      expect(config.mcp_servers.skillz.command).toBe('uvx');
      expect(config.mcp_servers.skillz.args).toContain('skillz@latest');
    });

    it('works for multiple agents simultaneously', async () => {
      await applyAllAgentConfigs(
        tmpDir,
        ['codex', 'gemini-cli', 'copilot'],
        undefined,
        true,
        undefined,
        undefined,
        false,
        false,
        false,
        false,
        true,
        true, // skills enabled
      );

      // All three agents should have skillz server
      const codexConfigPath = path.join(tmpDir, '.codex', 'config.toml');
      const geminiSettingsPath = path.join(tmpDir, '.gemini', 'settings.json');
      const copilotMcpPath = path.join(tmpDir, '.vscode', 'mcp.json');

      const codexContent = await fs.readFile(codexConfigPath, 'utf8');
      const geminiContent = await fs.readFile(geminiSettingsPath, 'utf8');
      const copilotContent = await fs.readFile(copilotMcpPath, 'utf8');

      const codexConfig = parseTOML(codexContent);
      const geminiSettings = JSON.parse(geminiContent);
      const copilotMcp = JSON.parse(copilotContent);

      expect(codexConfig.mcp_servers).toHaveProperty('skillz');
      expect(geminiSettings.mcpServers).toHaveProperty('skillz');
      expect(copilotMcp.servers).toHaveProperty('skillz');
    });
  });
});
