import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { discoverSkills } from '../src/core/SkillsProcessor';
import { SKILL_MD_FILENAME } from '../src/constants';

describe('Skills Discovery and Validation', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-skills-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('discoverSkills', () => {
    it('discovers skills with SKILL.md in flat structure', async () => {
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');
      const skill2 = path.join(skillsDir, 'skill2');

      await fs.mkdir(skill1, { recursive: true });
      await fs.mkdir(skill2, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');
      await fs.writeFile(path.join(skill2, SKILL_MD_FILENAME), '# Skill 2');

      const result = await discoverSkills(tmpDir);

      expect(result.skills).toHaveLength(2);
      expect(result.skills[0].name).toBe('skill1');
      expect(result.skills[0].hasSkillMd).toBe(true);
      expect(result.skills[0].valid).toBe(true);
      expect(result.skills[1].name).toBe('skill2');
      expect(result.skills[1].hasSkillMd).toBe(true);
      expect(result.skills[1].valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('discovers skills in nested structure', async () => {
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const category = path.join(skillsDir, 'category');
      const nestedSkill = path.join(category, 'nested-skill');

      await fs.mkdir(nestedSkill, { recursive: true });
      await fs.writeFile(
        path.join(nestedSkill, SKILL_MD_FILENAME),
        '# Nested Skill',
      );

      const result = await discoverSkills(tmpDir);

      expect(result.skills).toHaveLength(1);
      expect(result.skills[0].name).toBe('nested-skill');
      expect(result.skills[0].hasSkillMd).toBe(true);
      expect(result.skills[0].valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('warns about directories without SKILL.md and no sub-skills', async () => {
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const validSkill = path.join(skillsDir, 'valid-skill');
      const invalidDir = path.join(skillsDir, 'invalid-dir');

      await fs.mkdir(validSkill, { recursive: true });
      await fs.mkdir(invalidDir, { recursive: true });
      await fs.writeFile(
        path.join(validSkill, SKILL_MD_FILENAME),
        '# Valid Skill',
      );
      await fs.writeFile(path.join(invalidDir, 'README.md'), '# Not a skill');

      const result = await discoverSkills(tmpDir);

      expect(result.skills).toHaveLength(1);
      expect(result.skills[0].name).toBe('valid-skill');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('invalid-dir');
    });

    it('allows grouping directories with no SKILL.md if they contain sub-skills', async () => {
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const category = path.join(skillsDir, 'category');
      const subSkill1 = path.join(category, 'sub-skill-1');
      const subSkill2 = path.join(category, 'sub-skill-2');

      await fs.mkdir(subSkill1, { recursive: true });
      await fs.mkdir(subSkill2, { recursive: true });
      await fs.writeFile(
        path.join(subSkill1, SKILL_MD_FILENAME),
        '# Sub Skill 1',
      );
      await fs.writeFile(
        path.join(subSkill2, SKILL_MD_FILENAME),
        '# Sub Skill 2',
      );

      const result = await discoverSkills(tmpDir);

      expect(result.skills).toHaveLength(2);
      expect(result.warnings).toHaveLength(0);
    });

    it('returns empty result when .ruler/skills does not exist', async () => {
      const result = await discoverSkills(tmpDir);

      expect(result.skills).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('copySkillsDirectory', () => {
    it('copies .ruler/skills to destination preserving structure', async () => {
      const { copySkillsDirectory } = await import('../src/core/SkillsUtils');
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');
      const nested = path.join(skillsDir, 'category', 'nested-skill');

      await fs.mkdir(skill1, { recursive: true });
      await fs.mkdir(nested, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');
      await fs.writeFile(path.join(skill1, 'helper.py'), 'print("helper")');
      await fs.writeFile(
        path.join(nested, SKILL_MD_FILENAME),
        '# Nested Skill',
      );

      const destDir = path.join(tmpDir, '.claude', 'skills');
      await copySkillsDirectory(skillsDir, destDir);

      const copiedSkill1 = path.join(destDir, 'skill1', SKILL_MD_FILENAME);
      const copiedHelper = path.join(destDir, 'skill1', 'helper.py');
      const copiedNested = path.join(
        destDir,
        'category',
        'nested-skill',
        SKILL_MD_FILENAME,
      );

      expect(await fs.readFile(copiedSkill1, 'utf8')).toBe('# Skill 1');
      expect(await fs.readFile(copiedHelper, 'utf8')).toBe('print("helper")');
      expect(await fs.readFile(copiedNested, 'utf8')).toBe('# Nested Skill');
    });

    it('creates destination directory if it does not exist', async () => {
      const { copySkillsDirectory } = await import('../src/core/SkillsUtils');
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');

      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      const destDir = path.join(tmpDir, '.claude', 'skills');
      await copySkillsDirectory(skillsDir, destDir);

      const copiedSkill1 = path.join(destDir, 'skill1', SKILL_MD_FILENAME);
      expect(await fs.readFile(copiedSkill1, 'utf8')).toBe('# Skill 1');
    });
  });

  describe('propagateSkills - cleanup when disabled', () => {
    it('removes skills directories when skills are disabled', async () => {
      const { propagateSkills } = await import('../src/core/SkillsProcessor');
      const { allAgents } = await import('../src/lib');
      const claudeSkillsDir = path.join(tmpDir, '.claude', 'skills');
      const opencodeSkillsDir = path.join(tmpDir, '.opencode', 'skill');
      const piSkillsDir = path.join(tmpDir, '.pi', 'skills');
      const gooseSkillsDir = path.join(tmpDir, '.agents', 'skills');
      const vibeSkillsDir = path.join(tmpDir, '.vibe', 'skills');
      const rooSkillsDir = path.join(tmpDir, '.roo', 'skills');
      const geminiSkillsDir = path.join(tmpDir, '.gemini', 'skills');
      const cursorSkillsDir = path.join(tmpDir, '.cursor', 'skills');
      const skillzDir = path.join(tmpDir, '.skillz');

      // Create existing skills directories (as if they were from previous run)
      const claudeOldSkill = path.join(claudeSkillsDir, 'old-skill');
      const opencodeOldSkill = path.join(opencodeSkillsDir, 'old-skill');
      const piOldSkill = path.join(piSkillsDir, 'old-skill');
      const gooseOldSkill = path.join(gooseSkillsDir, 'old-skill');
      const vibeOldSkill = path.join(vibeSkillsDir, 'old-skill');
      const rooOldSkill = path.join(rooSkillsDir, 'old-skill');
      const geminiOldSkill = path.join(geminiSkillsDir, 'old-skill');
      const cursorOldSkill = path.join(cursorSkillsDir, 'old-skill');
      const skillzOldSkill = path.join(skillzDir, 'old-skill');
      await fs.mkdir(claudeOldSkill, { recursive: true });
      await fs.mkdir(opencodeOldSkill, { recursive: true });
      await fs.mkdir(piOldSkill, { recursive: true });
      await fs.mkdir(gooseOldSkill, { recursive: true });
      await fs.mkdir(vibeOldSkill, { recursive: true });
      await fs.mkdir(rooOldSkill, { recursive: true });
      await fs.mkdir(geminiOldSkill, { recursive: true });
      await fs.mkdir(cursorOldSkill, { recursive: true });
      await fs.mkdir(skillzOldSkill, { recursive: true });
      await fs.writeFile(
        path.join(claudeOldSkill, SKILL_MD_FILENAME),
        '# Old Skill',
      );
      await fs.writeFile(
        path.join(opencodeOldSkill, SKILL_MD_FILENAME),
        '# Old Skill',
      );
      await fs.writeFile(
        path.join(piOldSkill, SKILL_MD_FILENAME),
        '# Old Skill',
      );
      await fs.writeFile(
        path.join(gooseOldSkill, SKILL_MD_FILENAME),
        '# Old Skill',
      );
      await fs.writeFile(
        path.join(vibeOldSkill, SKILL_MD_FILENAME),
        '# Old Skill',
      );
      await fs.writeFile(
        path.join(rooOldSkill, SKILL_MD_FILENAME),
        '# Old Skill',
      );
      await fs.writeFile(
        path.join(geminiOldSkill, SKILL_MD_FILENAME),
        '# Old Skill',
      );
      await fs.writeFile(
        path.join(cursorOldSkill, SKILL_MD_FILENAME),
        '# Old Skill',
      );
      await fs.writeFile(
        path.join(skillzOldSkill, SKILL_MD_FILENAME),
        '# Old Skill',
      );

      // Verify directories exist before cleanup
      await expect(fs.access(claudeSkillsDir)).resolves.toBeUndefined();
      await expect(fs.access(opencodeSkillsDir)).resolves.toBeUndefined();
      await expect(fs.access(piSkillsDir)).resolves.toBeUndefined();
      await expect(fs.access(gooseSkillsDir)).resolves.toBeUndefined();
      await expect(fs.access(vibeSkillsDir)).resolves.toBeUndefined();
      await expect(fs.access(rooSkillsDir)).resolves.toBeUndefined();
      await expect(fs.access(geminiSkillsDir)).resolves.toBeUndefined();
      await expect(fs.access(cursorSkillsDir)).resolves.toBeUndefined();
      await expect(fs.access(skillzDir)).resolves.toBeUndefined();

      // Run propagateSkills with skillsEnabled = false
      await propagateSkills(tmpDir, allAgents, false, false, false);

      // Verify directories were removed
      await expect(fs.access(claudeSkillsDir)).rejects.toThrow();
      await expect(fs.access(opencodeSkillsDir)).rejects.toThrow();
      await expect(fs.access(piSkillsDir)).rejects.toThrow();
      await expect(fs.access(gooseSkillsDir)).rejects.toThrow();
      await expect(fs.access(vibeSkillsDir)).rejects.toThrow();
      await expect(fs.access(rooSkillsDir)).rejects.toThrow();
      await expect(fs.access(geminiSkillsDir)).rejects.toThrow();
      await expect(fs.access(cursorSkillsDir)).rejects.toThrow();
      await expect(fs.access(skillzDir)).rejects.toThrow();
    });

    it('logs cleanup in dry-run mode without actually removing directories', async () => {
      const { propagateSkills } = await import('../src/core/SkillsProcessor');
      const { allAgents } = await import('../src/lib');
      const claudeSkillsDir = path.join(tmpDir, '.claude', 'skills');
      const skillzDir = path.join(tmpDir, '.skillz');

      // Create existing skills directories
      await fs.mkdir(claudeSkillsDir, { recursive: true });
      await fs.mkdir(skillzDir, { recursive: true });

      // Run propagateSkills with skillsEnabled = false in dry-run mode
      await propagateSkills(tmpDir, allAgents, false, true, true);

      // Verify directories still exist (dry-run doesn't remove)
      await expect(fs.access(claudeSkillsDir)).resolves.toBeUndefined();
      await expect(fs.access(skillzDir)).resolves.toBeUndefined();
    });

    it('handles cleanup gracefully when directories do not exist', async () => {
      const { propagateSkills } = await import('../src/core/SkillsProcessor');
      const { allAgents } = await import('../src/lib');

      // Run propagateSkills with skillsEnabled = false when no directories exist
      await expect(
        propagateSkills(tmpDir, allAgents, false, false, false),
      ).resolves.toBeUndefined();
    });
  });

  describe('propagateSkills - agent-specific propagation', () => {
    it('only propagates skills to selected agents', async () => {
      const { propagateSkills } = await import('../src/core/SkillsProcessor');
      const { ClaudeAgent } = await import('../src/agents/ClaudeAgent');

      // Create skills directory
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');
      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      // Only select Claude agent
      const claudeAgent = new ClaudeAgent();
      await propagateSkills(tmpDir, [claudeAgent], true, false, false);

      // Claude skills should exist
      const claudeSkillsDir = path.join(tmpDir, '.claude', 'skills');
      await expect(fs.access(claudeSkillsDir)).resolves.toBeUndefined();

      // Other agent directories should NOT exist
      const codexSkillsDir = path.join(tmpDir, '.codex', 'skills');
      const piSkillsDir = path.join(tmpDir, '.pi', 'skills');
      const rooSkillsDir = path.join(tmpDir, '.roo', 'skills');
      const geminiSkillsDir = path.join(tmpDir, '.gemini', 'skills');
      await expect(fs.access(codexSkillsDir)).rejects.toThrow();
      await expect(fs.access(piSkillsDir)).rejects.toThrow();
      await expect(fs.access(rooSkillsDir)).rejects.toThrow();
      await expect(fs.access(geminiSkillsDir)).rejects.toThrow();
    });

    it('propagates to multiple selected agents', async () => {
      const { propagateSkills } = await import('../src/core/SkillsProcessor');
      const { ClaudeAgent } = await import('../src/agents/ClaudeAgent');
      const { CodexCliAgent } = await import('../src/agents/CodexCliAgent');

      // Create skills directory
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');
      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      // Select Claude and Codex agents
      const claudeAgent = new ClaudeAgent();
      const codexAgent = new CodexCliAgent();
      await propagateSkills(
        tmpDir,
        [claudeAgent, codexAgent],
        true,
        false,
        false,
      );

      // Both should exist
      const claudeSkillsDir = path.join(tmpDir, '.claude', 'skills');
      const codexSkillsDir = path.join(tmpDir, '.codex', 'skills');
      await expect(fs.access(claudeSkillsDir)).resolves.toBeUndefined();
      await expect(fs.access(codexSkillsDir)).resolves.toBeUndefined();

      // Others should NOT exist
      const piSkillsDir = path.join(tmpDir, '.pi', 'skills');
      const rooSkillsDir = path.join(tmpDir, '.roo', 'skills');
      await expect(fs.access(piSkillsDir)).rejects.toThrow();
      await expect(fs.access(rooSkillsDir)).rejects.toThrow();
    });

    it('does not duplicate paths when agents share skills directory', async () => {
      const { propagateSkills } = await import('../src/core/SkillsProcessor');
      const { ClaudeAgent } = await import('../src/agents/ClaudeAgent');
      const { CopilotAgent } = await import('../src/agents/CopilotAgent');

      // Create skills directory
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');
      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      // Select both Claude and Copilot (they share .claude/skills)
      const claudeAgent = new ClaudeAgent();
      const copilotAgent = new CopilotAgent();
      await propagateSkills(
        tmpDir,
        [claudeAgent, copilotAgent],
        true,
        false,
        false,
      );

      // Claude skills should exist
      const claudeSkillsDir = path.join(tmpDir, '.claude', 'skills');
      await expect(fs.access(claudeSkillsDir)).resolves.toBeUndefined();

      // Verify the skill was copied correctly (not corrupted by double copy)
      const copiedSkill = path.join(claudeSkillsDir, 'skill1', SKILL_MD_FILENAME);
      expect(await fs.readFile(copiedSkill, 'utf8')).toBe('# Skill 1');
    });

    it('does not propagate skills for agents without native skills support', async () => {
      const { propagateSkills } = await import('../src/core/SkillsProcessor');
      const { AiderAgent } = await import('../src/agents/AiderAgent');

      // Create skills directory
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');
      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      // Select Aider (which does not support native skills)
      const aiderAgent = new AiderAgent();
      await propagateSkills(tmpDir, [aiderAgent], true, false, false);

      // No skills directories should be created
      const claudeSkillsDir = path.join(tmpDir, '.claude', 'skills');
      const codexSkillsDir = path.join(tmpDir, '.codex', 'skills');
      await expect(fs.access(claudeSkillsDir)).rejects.toThrow();
      await expect(fs.access(codexSkillsDir)).rejects.toThrow();
    });
  });

  describe('getSkillsGitignorePaths - agent-specific paths', () => {
    it('returns only paths for selected agents', async () => {
      const { getSkillsGitignorePaths } = await import(
        '../src/core/SkillsProcessor'
      );
      const { ClaudeAgent } = await import('../src/agents/ClaudeAgent');

      // Create skills directory
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');
      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      const claudeAgent = new ClaudeAgent();
      const paths = await getSkillsGitignorePaths(tmpDir, [claudeAgent]);

      expect(paths).toHaveLength(1);
      expect(paths[0]).toContain('.claude');
    });

    it('returns paths for multiple selected agents', async () => {
      const { getSkillsGitignorePaths } = await import(
        '../src/core/SkillsProcessor'
      );
      const { ClaudeAgent } = await import('../src/agents/ClaudeAgent');
      const { CodexCliAgent } = await import('../src/agents/CodexCliAgent');

      // Create skills directory
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');
      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      const claudeAgent = new ClaudeAgent();
      const codexAgent = new CodexCliAgent();
      const paths = await getSkillsGitignorePaths(tmpDir, [
        claudeAgent,
        codexAgent,
      ]);

      expect(paths).toHaveLength(2);
      expect(paths.some((p) => p.includes('.claude'))).toBe(true);
      expect(paths.some((p) => p.includes('.codex'))).toBe(true);
    });

    it('does not return duplicate paths for agents sharing skills directory', async () => {
      const { getSkillsGitignorePaths } = await import(
        '../src/core/SkillsProcessor'
      );
      const { ClaudeAgent } = await import('../src/agents/ClaudeAgent');
      const { CopilotAgent } = await import('../src/agents/CopilotAgent');

      // Create skills directory
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');
      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      const claudeAgent = new ClaudeAgent();
      const copilotAgent = new CopilotAgent();
      const paths = await getSkillsGitignorePaths(tmpDir, [
        claudeAgent,
        copilotAgent,
      ]);

      // Should only have 1 path since both use .claude/skills
      expect(paths).toHaveLength(1);
      expect(paths[0]).toContain('.claude');
    });

    it('returns empty array when skills directory does not exist', async () => {
      const { getSkillsGitignorePaths } = await import(
        '../src/core/SkillsProcessor'
      );
      const { ClaudeAgent } = await import('../src/agents/ClaudeAgent');

      const claudeAgent = new ClaudeAgent();
      const paths = await getSkillsGitignorePaths(tmpDir, [claudeAgent]);

      expect(paths).toHaveLength(0);
    });
  });
});
