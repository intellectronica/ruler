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

  describe('propagateSkillsForClaude', () => {
    it('copies .ruler/skills to .claude/skills preserving structure', async () => {
      const { propagateSkillsForClaude } = await import(
        '../src/core/SkillsProcessor'
      );
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');

      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      await propagateSkillsForClaude(tmpDir, { dryRun: false });

      const claudeSkillsDir = path.join(tmpDir, '.claude', 'skills');
      const copiedSkill = path.join(
        claudeSkillsDir,
        'skill1',
        SKILL_MD_FILENAME,
      );
      expect(await fs.readFile(copiedSkill, 'utf8')).toBe('# Skill 1');
    });

    it('creates .claude directory if it does not exist', async () => {
      const { propagateSkillsForClaude } = await import(
        '../src/core/SkillsProcessor'
      );
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');

      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      await propagateSkillsForClaude(tmpDir, { dryRun: false });

      const claudeDir = path.join(tmpDir, '.claude');
      const stats = await fs.stat(claudeDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('uses atomic replace when overwriting existing skills', async () => {
      const { propagateSkillsForClaude } = await import(
        '../src/core/SkillsProcessor'
      );
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');
      const claudeSkillsDir = path.join(tmpDir, '.claude', 'skills');
      const oldSkill = path.join(claudeSkillsDir, 'old-skill');

      // Create old skills
      await fs.mkdir(oldSkill, { recursive: true });
      await fs.writeFile(path.join(oldSkill, SKILL_MD_FILENAME), '# Old Skill');

      // Create new skills
      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      await propagateSkillsForClaude(tmpDir, { dryRun: false });

      // Old skill should be replaced
      const copiedSkill = path.join(
        claudeSkillsDir,
        'skill1',
        SKILL_MD_FILENAME,
      );
      expect(await fs.readFile(copiedSkill, 'utf8')).toBe('# Skill 1');

      // Old skill should not exist
      await expect(fs.access(oldSkill)).rejects.toThrow();
    });

    it('includes operations in dry-run preview without executing', async () => {
      const { propagateSkillsForClaude } = await import(
        '../src/core/SkillsProcessor'
      );
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');

      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      const steps = await propagateSkillsForClaude(tmpDir, { dryRun: true });

      expect(steps.length).toBeGreaterThan(0);
      expect(steps.some((step) => step.includes('.claude/skills'))).toBe(true);

      // Should not have actually copied
      const claudeSkillsDir = path.join(tmpDir, '.claude', 'skills');
      await expect(fs.access(claudeSkillsDir)).rejects.toThrow();
    });

    it('no-ops gracefully when .ruler/skills does not exist', async () => {
      const { propagateSkillsForClaude } = await import(
        '../src/core/SkillsProcessor'
      );

      const steps = await propagateSkillsForClaude(tmpDir, { dryRun: true });

      expect(steps).toHaveLength(0);
    });
  });

  describe('propagateSkillsForOpenCode', () => {
    it('copies .ruler/skills to .opencode/skill preserving structure', async () => {
      const { propagateSkillsForOpenCode } = await import(
        '../src/core/SkillsProcessor'
      );
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');

      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      await propagateSkillsForOpenCode(tmpDir, { dryRun: false });

      const opencodeSkillsDir = path.join(tmpDir, '.opencode', 'skill');
      const copiedSkill = path.join(
        opencodeSkillsDir,
        'skill1',
        SKILL_MD_FILENAME,
      );
      expect(await fs.readFile(copiedSkill, 'utf8')).toBe('# Skill 1');
    });

    it('creates .opencode directory if it does not exist', async () => {
      const { propagateSkillsForOpenCode } = await import(
        '../src/core/SkillsProcessor'
      );
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');

      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      await propagateSkillsForOpenCode(tmpDir, { dryRun: false });

      const opencodeDir = path.join(tmpDir, '.opencode');
      const stats = await fs.stat(opencodeDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('includes operations in dry-run preview without executing', async () => {
      const { propagateSkillsForOpenCode } = await import(
        '../src/core/SkillsProcessor'
      );
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');

      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      const steps = await propagateSkillsForOpenCode(tmpDir, { dryRun: true });

      expect(steps.length).toBeGreaterThan(0);
      expect(steps.some((step) => step.includes('.opencode/skill'))).toBe(true);

      // Should not have actually copied
      const opencodeSkillsDir = path.join(tmpDir, '.opencode', 'skill');
      await expect(fs.access(opencodeSkillsDir)).rejects.toThrow();
    });

    it('no-ops gracefully when .ruler/skills does not exist', async () => {
      const { propagateSkillsForOpenCode } = await import(
        '../src/core/SkillsProcessor'
      );

      const steps = await propagateSkillsForOpenCode(tmpDir, { dryRun: true });

      expect(steps).toHaveLength(0);
    });
  });

  describe('propagateSkillsForPi', () => {
    it('copies .ruler/skills to .pi/skills preserving structure', async () => {
      const { propagateSkillsForPi } = await import(
        '../src/core/SkillsProcessor'
      );
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');

      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      await propagateSkillsForPi(tmpDir, { dryRun: false });

      const piSkillsDir = path.join(tmpDir, '.pi', 'skills');
      const copiedSkill = path.join(piSkillsDir, 'skill1', SKILL_MD_FILENAME);
      expect(await fs.readFile(copiedSkill, 'utf8')).toBe('# Skill 1');
    });

    it('creates .pi directory if it does not exist', async () => {
      const { propagateSkillsForPi } = await import(
        '../src/core/SkillsProcessor'
      );
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');

      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      await propagateSkillsForPi(tmpDir, { dryRun: false });

      const piDir = path.join(tmpDir, '.pi');
      const stats = await fs.stat(piDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('includes operations in dry-run preview without executing', async () => {
      const { propagateSkillsForPi } = await import(
        '../src/core/SkillsProcessor'
      );
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');

      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      const steps = await propagateSkillsForPi(tmpDir, { dryRun: true });

      expect(steps.length).toBeGreaterThan(0);
      expect(steps.some((step) => step.includes('.pi/skills'))).toBe(true);

      // Should not have actually copied
      const piSkillsDir = path.join(tmpDir, '.pi', 'skills');
      await expect(fs.access(piSkillsDir)).rejects.toThrow();
    });

    it('no-ops gracefully when .ruler/skills does not exist', async () => {
      const { propagateSkillsForPi } = await import(
        '../src/core/SkillsProcessor'
      );

      const steps = await propagateSkillsForPi(tmpDir, { dryRun: true });

      expect(steps).toHaveLength(0);
    });
  });

  describe('propagateSkillsForGoose', () => {
    it('copies .ruler/skills to .agents/skills preserving structure', async () => {
      const { propagateSkillsForGoose } = await import(
        '../src/core/SkillsProcessor'
      );
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');

      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      await propagateSkillsForGoose(tmpDir, { dryRun: false });

      const gooseSkillsDir = path.join(tmpDir, '.agents', 'skills');
      const copiedSkill = path.join(
        gooseSkillsDir,
        'skill1',
        SKILL_MD_FILENAME,
      );
      expect(await fs.readFile(copiedSkill, 'utf8')).toBe('# Skill 1');
    });

    it('creates .agents directory if it does not exist', async () => {
      const { propagateSkillsForGoose } = await import(
        '../src/core/SkillsProcessor'
      );
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');

      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      await propagateSkillsForGoose(tmpDir, { dryRun: false });

      const agentsDir = path.join(tmpDir, '.agents');
      const stats = await fs.stat(agentsDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('includes operations in dry-run preview without executing', async () => {
      const { propagateSkillsForGoose } = await import(
        '../src/core/SkillsProcessor'
      );
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');

      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      const steps = await propagateSkillsForGoose(tmpDir, { dryRun: true });

      expect(steps.length).toBeGreaterThan(0);
      expect(steps.some((step) => step.includes('.agents/skills'))).toBe(true);

      // Should not have actually copied
      const gooseSkillsDir = path.join(tmpDir, '.agents', 'skills');
      await expect(fs.access(gooseSkillsDir)).rejects.toThrow();
    });

    it('no-ops gracefully when .ruler/skills does not exist', async () => {
      const { propagateSkillsForGoose } = await import(
        '../src/core/SkillsProcessor'
      );

      const steps = await propagateSkillsForGoose(tmpDir, { dryRun: true });

      expect(steps).toHaveLength(0);
    });
  });

  describe('propagateSkillsForVibe', () => {
    it('copies .ruler/skills to .vibe/skills preserving structure', async () => {
      const { propagateSkillsForVibe } = await import(
        '../src/core/SkillsProcessor'
      );
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');

      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      await propagateSkillsForVibe(tmpDir, { dryRun: false });

      const vibeSkillsDir = path.join(tmpDir, '.vibe', 'skills');
      const copiedSkill = path.join(vibeSkillsDir, 'skill1', SKILL_MD_FILENAME);
      expect(await fs.readFile(copiedSkill, 'utf8')).toBe('# Skill 1');
    });

    it('creates .vibe directory if it does not exist', async () => {
      const { propagateSkillsForVibe } = await import(
        '../src/core/SkillsProcessor'
      );
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');

      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      await propagateSkillsForVibe(tmpDir, { dryRun: false });

      const vibeDir = path.join(tmpDir, '.vibe');
      const stats = await fs.stat(vibeDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('includes operations in dry-run preview without executing', async () => {
      const { propagateSkillsForVibe } = await import(
        '../src/core/SkillsProcessor'
      );
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');

      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      const steps = await propagateSkillsForVibe(tmpDir, { dryRun: true });

      expect(steps.length).toBeGreaterThan(0);
      expect(steps.some((step) => step.includes('.vibe/skills'))).toBe(true);

      // Should not have actually copied
      const vibeSkillsDir = path.join(tmpDir, '.vibe', 'skills');
      await expect(fs.access(vibeSkillsDir)).rejects.toThrow();
    });

    it('no-ops gracefully when .ruler/skills does not exist', async () => {
      const { propagateSkillsForVibe } = await import(
        '../src/core/SkillsProcessor'
      );

      const steps = await propagateSkillsForVibe(tmpDir, { dryRun: true });

      expect(steps).toHaveLength(0);
    });
  });

  describe('propagateSkillsForRoo', () => {
    it('copies .ruler/skills to .roo/skills preserving structure', async () => {
      const { propagateSkillsForRoo } = await import(
        '../src/core/SkillsProcessor'
      );
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');

      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      await propagateSkillsForRoo(tmpDir, { dryRun: false });

      const rooSkillsDir = path.join(tmpDir, '.roo', 'skills');
      const copiedSkill = path.join(rooSkillsDir, 'skill1', SKILL_MD_FILENAME);
      expect(await fs.readFile(copiedSkill, 'utf8')).toBe('# Skill 1');
    });

    it('creates .roo directory if it does not exist', async () => {
      const { propagateSkillsForRoo } = await import(
        '../src/core/SkillsProcessor'
      );
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');

      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      await propagateSkillsForRoo(tmpDir, { dryRun: false });

      const rooDir = path.join(tmpDir, '.roo');
      const stats = await fs.stat(rooDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('includes operations in dry-run preview without executing', async () => {
      const { propagateSkillsForRoo } = await import(
        '../src/core/SkillsProcessor'
      );
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');

      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      const steps = await propagateSkillsForRoo(tmpDir, { dryRun: true });

      expect(steps.length).toBeGreaterThan(0);
      expect(steps.some((step) => step.includes('.roo/skills'))).toBe(true);

      // Should not have actually copied
      const rooSkillsDir = path.join(tmpDir, '.roo', 'skills');
      await expect(fs.access(rooSkillsDir)).rejects.toThrow();
    });

    it('no-ops gracefully when .ruler/skills does not exist', async () => {
      const { propagateSkillsForRoo } = await import(
        '../src/core/SkillsProcessor'
      );

      const steps = await propagateSkillsForRoo(tmpDir, { dryRun: true });

      expect(steps).toHaveLength(0);
    });
  });

  describe('propagateSkillsForGemini', () => {
    it('copies .ruler/skills to .gemini/skills preserving structure', async () => {
      const { propagateSkillsForGemini } = await import(
        '../src/core/SkillsProcessor'
      );
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');

      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      await propagateSkillsForGemini(tmpDir, { dryRun: false });

      const geminiSkillsDir = path.join(tmpDir, '.gemini', 'skills');
      const copiedSkill = path.join(
        geminiSkillsDir,
        'skill1',
        SKILL_MD_FILENAME,
      );
      expect(await fs.readFile(copiedSkill, 'utf8')).toBe('# Skill 1');
    });

    it('creates .gemini directory if it does not exist', async () => {
      const { propagateSkillsForGemini } = await import(
        '../src/core/SkillsProcessor'
      );
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');

      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      await propagateSkillsForGemini(tmpDir, { dryRun: false });

      const geminiDir = path.join(tmpDir, '.gemini');
      const stats = await fs.stat(geminiDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('includes operations in dry-run preview without executing', async () => {
      const { propagateSkillsForGemini } = await import(
        '../src/core/SkillsProcessor'
      );
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');

      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      const steps = await propagateSkillsForGemini(tmpDir, { dryRun: true });

      expect(steps.length).toBeGreaterThan(0);
      expect(steps.some((step) => step.includes('.gemini/skills'))).toBe(true);

      // Should not have actually copied
      const geminiSkillsDir = path.join(tmpDir, '.gemini', 'skills');
      await expect(fs.access(geminiSkillsDir)).rejects.toThrow();
    });

    it('no-ops gracefully when .ruler/skills does not exist', async () => {
      const { propagateSkillsForGemini } = await import(
        '../src/core/SkillsProcessor'
      );

      const steps = await propagateSkillsForGemini(tmpDir, { dryRun: true });

      expect(steps).toHaveLength(0);
    });
  });

  describe('propagateSkillsForCursor', () => {
    it('copies .ruler/skills to .cursor/skills preserving structure', async () => {
      const { propagateSkillsForCursor } = await import(
        '../src/core/SkillsProcessor'
      );
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');

      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      await propagateSkillsForCursor(tmpDir, { dryRun: false });

      const cursorSkillsDir = path.join(tmpDir, '.cursor', 'skills');
      const copiedSkill = path.join(
        cursorSkillsDir,
        'skill1',
        SKILL_MD_FILENAME,
      );
      expect(await fs.readFile(copiedSkill, 'utf8')).toBe('# Skill 1');
    });

    it('creates .cursor directory if it does not exist', async () => {
      const { propagateSkillsForCursor } = await import(
        '../src/core/SkillsProcessor'
      );
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');

      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      await propagateSkillsForCursor(tmpDir, { dryRun: false });

      const cursorDir = path.join(tmpDir, '.cursor');
      const stats = await fs.stat(cursorDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('includes operations in dry-run preview without executing', async () => {
      const { propagateSkillsForCursor } = await import(
        '../src/core/SkillsProcessor'
      );
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');

      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      const steps = await propagateSkillsForCursor(tmpDir, { dryRun: true });

      expect(steps.length).toBeGreaterThan(0);
      expect(steps.some((step) => step.includes('.cursor/skills'))).toBe(true);

      // Should not have actually copied
      const cursorSkillsDir = path.join(tmpDir, '.cursor', 'skills');
      await expect(fs.access(cursorSkillsDir)).rejects.toThrow();
    });

    it('no-ops gracefully when .ruler/skills does not exist', async () => {
      const { propagateSkillsForCursor } = await import(
        '../src/core/SkillsProcessor'
      );

      const steps = await propagateSkillsForCursor(tmpDir, { dryRun: true });

      expect(steps).toHaveLength(0);
    });
  });

  describe('propagateSkillsForAntigravity', () => {
    it('copies .ruler/skills to .agent/skills preserving structure', async () => {
      const { propagateSkillsForAntigravity } = await import(
        '../src/core/SkillsProcessor'
      );
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');

      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      await propagateSkillsForAntigravity(tmpDir, { dryRun: false });

      const antigravitySkillsDir = path.join(tmpDir, '.agent', 'skills');
      const copiedSkill = path.join(
        antigravitySkillsDir,
        'skill1',
        SKILL_MD_FILENAME,
      );
      expect(await fs.readFile(copiedSkill, 'utf8')).toBe('# Skill 1');
    });

    it('creates .agent directory if it does not exist', async () => {
      const { propagateSkillsForAntigravity } = await import(
        '../src/core/SkillsProcessor'
      );
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');

      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      await propagateSkillsForAntigravity(tmpDir, { dryRun: false });

      const antigravityDir = path.join(tmpDir, '.agent');
      const stats = await fs.stat(antigravityDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('includes operations in dry-run preview without executing', async () => {
      const { propagateSkillsForAntigravity } = await import(
        '../src/core/SkillsProcessor'
      );
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');

      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      const steps = await propagateSkillsForAntigravity(tmpDir, {
        dryRun: true,
      });

      expect(steps.length).toBeGreaterThan(0);
      expect(steps.some((step) => step.includes('.agent/skills'))).toBe(true);

      // Should not have actually copied
      const antigravitySkillsDir = path.join(tmpDir, '.agent', 'skills');
      await expect(fs.access(antigravitySkillsDir)).rejects.toThrow();
    });

    it('no-ops gracefully when .ruler/skills does not exist', async () => {
      const { propagateSkillsForAntigravity } = await import(
        '../src/core/SkillsProcessor'
      );

      const steps = await propagateSkillsForAntigravity(tmpDir, {
        dryRun: true,
      });

      expect(steps).toHaveLength(0);
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
      const antigravitySkillsDir = path.join(tmpDir, '.agent', 'skills');
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
      const antigravityOldSkill = path.join(antigravitySkillsDir, 'old-skill');
      const skillzOldSkill = path.join(skillzDir, 'old-skill');
      await fs.mkdir(claudeOldSkill, { recursive: true });
      await fs.mkdir(opencodeOldSkill, { recursive: true });
      await fs.mkdir(piOldSkill, { recursive: true });
      await fs.mkdir(gooseOldSkill, { recursive: true });
      await fs.mkdir(vibeOldSkill, { recursive: true });
      await fs.mkdir(rooOldSkill, { recursive: true });
      await fs.mkdir(geminiOldSkill, { recursive: true });
      await fs.mkdir(cursorOldSkill, { recursive: true });
      await fs.mkdir(antigravityOldSkill, { recursive: true });
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
        path.join(antigravityOldSkill, SKILL_MD_FILENAME),
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
      await expect(fs.access(antigravitySkillsDir)).resolves.toBeUndefined();
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
      await expect(fs.access(antigravitySkillsDir)).rejects.toThrow();
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
});
