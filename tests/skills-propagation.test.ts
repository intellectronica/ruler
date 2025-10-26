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
      const { copySkillsDirectory } = await import(
        '../src/core/SkillsUtils'
      );
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');
      const nested = path.join(skillsDir, 'category', 'nested-skill');

      await fs.mkdir(skill1, { recursive: true });
      await fs.mkdir(nested, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');
      await fs.writeFile(
        path.join(skill1, 'helper.py'),
        'print("helper")',
      );
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
      const { copySkillsDirectory } = await import(
        '../src/core/SkillsUtils'
      );
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
});
