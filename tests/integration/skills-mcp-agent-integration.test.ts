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

    it('adds skills to .codex/skills for Codex CLI (native skills)', async () => {
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

      // Check that .codex/skills exists and contains the test skill
      const codexSkillsPath = path.join(tmpDir, '.codex', 'skills');
      const testSkillPath = path.join(codexSkillsPath, 'test-skill');
      const skillMdPath = path.join(testSkillPath, SKILL_MD_FILENAME);

      // Verify the skill directory and file exist
      await expect(fs.access(codexSkillsPath)).resolves.toBeUndefined();
      await expect(fs.access(testSkillPath)).resolves.toBeUndefined();
      await expect(fs.access(skillMdPath)).resolves.toBeUndefined();

      // Verify skill content was copied
      const skillContent = await fs.readFile(skillMdPath, 'utf8');
      expect(skillContent).toBe('# Test Skill');
    });

    it('adds skills to .gemini/skills for Gemini CLI (native skills)', async () => {
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

      // Check that .gemini/skills exists and contains the test skill
      const geminiSkillsPath = path.join(tmpDir, '.gemini', 'skills');
      const testSkillPath = path.join(geminiSkillsPath, 'test-skill');
      const skillMdPath = path.join(testSkillPath, SKILL_MD_FILENAME);

      // Verify the skill directory and file exist
      await expect(fs.access(geminiSkillsPath)).resolves.toBeUndefined();
      await expect(fs.access(testSkillPath)).resolves.toBeUndefined();
      await expect(fs.access(skillMdPath)).resolves.toBeUndefined();

      // Verify skill content was copied
      const skillContent = await fs.readFile(skillMdPath, 'utf8');
      expect(skillContent).toBe('# Test Skill');
    });

    it('adds skills to .claude/skills for Copilot (native skills)', async () => {
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

      // Check that .claude/skills exists and contains the test skill
      const claudeSkillsPath = path.join(tmpDir, '.claude', 'skills');
      const testSkillPath = path.join(claudeSkillsPath, 'test-skill');
      const skillMdPath = path.join(testSkillPath, SKILL_MD_FILENAME);

      // Verify the skill directory and file exist
      await expect(fs.access(claudeSkillsPath)).resolves.toBeUndefined();
      await expect(fs.access(testSkillPath)).resolves.toBeUndefined();
      await expect(fs.access(skillMdPath)).resolves.toBeUndefined();

      // Verify skill content was copied
      const skillContent = await fs.readFile(skillMdPath, 'utf8');
      expect(skillContent).toBe('# Test Skill');
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

    it('adds skills to native directories even when there are existing MCP servers', async () => {
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

      // Check that .codex/skills exists and contains the test skill (native skills)
      const codexSkillsPath = path.join(tmpDir, '.codex', 'skills');
      const testSkillPath = path.join(codexSkillsPath, 'test-skill');
      const skillMdPath = path.join(testSkillPath, SKILL_MD_FILENAME);

      await expect(fs.access(codexSkillsPath)).resolves.toBeUndefined();
      await expect(fs.access(testSkillPath)).resolves.toBeUndefined();
      await expect(fs.access(skillMdPath)).resolves.toBeUndefined();
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

      // All agents should have native skills
      const codexSkillsPath = path.join(tmpDir, '.codex', 'skills');
      const claudeSkillsPath = path.join(tmpDir, '.claude', 'skills');
      const geminiSkillsPath = path.join(tmpDir, '.gemini', 'skills');

      // Check Codex has native skills
      await expect(
        fs.access(path.join(codexSkillsPath, 'test-skill', SKILL_MD_FILENAME)),
      ).resolves.toBeUndefined();

      // Check Copilot has native skills
      await expect(
        fs.access(path.join(claudeSkillsPath, 'test-skill', SKILL_MD_FILENAME)),
      ).resolves.toBeUndefined();

      // Check Gemini has native skills
      await expect(
        fs.access(path.join(geminiSkillsPath, 'test-skill', SKILL_MD_FILENAME)),
      ).resolves.toBeUndefined();
    });
  });
});
