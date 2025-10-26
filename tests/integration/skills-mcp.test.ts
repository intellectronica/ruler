import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import {
  propagateSkillsForSkillz,
  buildSkillzMcpConfig,
} from '../../src/core/SkillsProcessor';
import { SKILL_MD_FILENAME, SKILLZ_DIR } from '../../src/constants';

describe('Skills MCP Integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-skills-mcp-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('propagateSkillsForSkillz', () => {
    it('copies .ruler/skills to .skillz preserving structure', async () => {
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');
      const nested = path.join(skillsDir, 'category', 'nested-skill');

      await fs.mkdir(skill1, { recursive: true });
      await fs.mkdir(nested, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');
      await fs.writeFile(
        path.join(nested, SKILL_MD_FILENAME),
        '# Nested Skill',
      );

      await propagateSkillsForSkillz(tmpDir, { dryRun: false });

      const skillzDir = path.join(tmpDir, SKILLZ_DIR);
      const copiedSkill1 = path.join(skillzDir, 'skill1', SKILL_MD_FILENAME);
      const copiedNested = path.join(
        skillzDir,
        'category',
        'nested-skill',
        SKILL_MD_FILENAME,
      );

      expect(await fs.readFile(copiedSkill1, 'utf8')).toBe('# Skill 1');
      expect(await fs.readFile(copiedNested, 'utf8')).toBe('# Nested Skill');
    });

    it('uses atomic replace when overwriting existing skills', async () => {
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');
      const skillzDir = path.join(tmpDir, SKILLZ_DIR);
      const oldSkill = path.join(skillzDir, 'old-skill');

      // Create old skills in .skillz
      await fs.mkdir(oldSkill, { recursive: true });
      await fs.writeFile(path.join(oldSkill, SKILL_MD_FILENAME), '# Old Skill');

      // Create new skills in .ruler/skills
      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      await propagateSkillsForSkillz(tmpDir, { dryRun: false });

      // Old skill should be replaced
      const copiedSkill = path.join(skillzDir, 'skill1', SKILL_MD_FILENAME);
      expect(await fs.readFile(copiedSkill, 'utf8')).toBe('# Skill 1');

      // Old skill should not exist
      await expect(fs.access(oldSkill)).rejects.toThrow();
    });

    it('includes operations in dry-run preview without executing', async () => {
      const skillsDir = path.join(tmpDir, '.ruler', 'skills');
      const skill1 = path.join(skillsDir, 'skill1');

      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Skill 1');

      const steps = await propagateSkillsForSkillz(tmpDir, { dryRun: true });

      expect(steps.length).toBeGreaterThan(0);
      expect(steps.some((step) => step.includes('.skillz'))).toBe(true);

      // Should not have actually copied
      const skillzDir = path.join(tmpDir, SKILLZ_DIR);
      await expect(fs.access(skillzDir)).rejects.toThrow();
    });

    it('no-ops gracefully when .ruler/skills does not exist', async () => {
      const steps = await propagateSkillsForSkillz(tmpDir, { dryRun: true });
      expect(steps).toHaveLength(0);
    });
  });

  describe('buildSkillzMcpConfig', () => {
    it('creates MCP config with absolute path', () => {
      const config = buildSkillzMcpConfig(tmpDir);
      
      expect(config).toHaveProperty('skillz');
      expect(config.skillz).toEqual({
        command: 'uvx',
        args: ['skillz@latest', path.resolve(tmpDir, SKILLZ_DIR)],
      });
    });

    it('uses absolute path even for relative project root', () => {
      const relativeRoot = './my-project';
      const config = buildSkillzMcpConfig(relativeRoot);
      
      const skillzPath = (config.skillz as any).args[1];
      expect(path.isAbsolute(skillzPath)).toBe(true);
    });
  });
});
