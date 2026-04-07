import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import {
  discoverGlobalSkills,
  propagateSkills,
} from '../src/core/SkillsProcessor';
import { mergeSkillsDirectories } from '../src/core/SkillsUtils';
import {
  CLAUDE_SKILLS_PATH,
  CURSOR_SKILLS_PATH,
  CODEX_SKILLS_PATH,
  SKILL_MD_FILENAME,
} from '../src/constants';

// Mock findGlobalRulerDir to point to our test directory
let mockGlobalDir: string | null = null;
jest.mock('../src/core/FileSystemUtils', () => {
  const actual = jest.requireActual('../src/core/FileSystemUtils');
  return {
    ...actual,
    findGlobalRulerDir: jest.fn(async () => mockGlobalDir),
  };
});

// Create a mock agent that supports native skills
function createMockAgent(identifier: string, name: string, supportsSkills: boolean) {
  return {
    getIdentifier: () => identifier,
    getName: () => name,
    supportsNativeSkills: () => supportsSkills,
    getOutputPaths: () => [],
    apply: jest.fn(),
    revert: jest.fn(),
    getMcpConfigPath: () => null,
    getMcpStrategy: () => 'merge' as const,
    getMcpServerKey: () => 'mcpServers',
    applyRulerConfig: jest.fn(),
    getDefaultOutputPath: () => '',
  };
}

describe('Global Skills Support', () => {
  let tmpDir: string;
  let globalDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-global-skills-'));
    globalDir = path.join(tmpDir, 'global-config', 'ruler');
    await fs.mkdir(globalDir, { recursive: true });
    mockGlobalDir = globalDir;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    mockGlobalDir = null;
  });

  describe('discoverGlobalSkills', () => {
    it('discovers skills from the global config directory', async () => {
      const globalSkillsDir = path.join(globalDir, 'skills');
      const skill1 = path.join(globalSkillsDir, 'global-skill');
      await fs.mkdir(skill1, { recursive: true });
      await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Global Skill');

      const result = await discoverGlobalSkills();

      expect(result.skills).toHaveLength(1);
      expect(result.skills[0].name).toBe('global-skill');
      expect(result.globalSkillsDir).toBe(globalSkillsDir);
    });

    it('returns empty when no global skills directory exists', async () => {
      // globalDir exists but has no 'skills' subdirectory
      const result = await discoverGlobalSkills();

      expect(result.skills).toHaveLength(0);
      expect(result.globalSkillsDir).toBeNull();
    });

    it('returns empty when no global ruler dir exists', async () => {
      mockGlobalDir = null;

      const result = await discoverGlobalSkills();

      expect(result.skills).toHaveLength(0);
      expect(result.globalSkillsDir).toBeNull();
    });
  });

  describe('mergeSkillsDirectories', () => {
    it('merges global and local skills with local taking precedence', async () => {
      const globalSkills = path.join(tmpDir, 'global-skills');
      const localSkills = path.join(tmpDir, 'local-skills');
      const merged = path.join(tmpDir, 'merged');

      // Global skill
      const globalSkill = path.join(globalSkills, 'shared-skill');
      await fs.mkdir(globalSkill, { recursive: true });
      await fs.writeFile(path.join(globalSkill, SKILL_MD_FILENAME), '# Global Version');

      // Global-only skill
      const globalOnly = path.join(globalSkills, 'global-only');
      await fs.mkdir(globalOnly, { recursive: true });
      await fs.writeFile(path.join(globalOnly, SKILL_MD_FILENAME), '# Global Only');

      // Local skill with same name (should override)
      const localSkill = path.join(localSkills, 'shared-skill');
      await fs.mkdir(localSkill, { recursive: true });
      await fs.writeFile(path.join(localSkill, SKILL_MD_FILENAME), '# Local Version');

      // Local-only skill
      const localOnly = path.join(localSkills, 'local-only');
      await fs.mkdir(localOnly, { recursive: true });
      await fs.writeFile(path.join(localOnly, SKILL_MD_FILENAME), '# Local Only');

      await mergeSkillsDirectories(globalSkills, localSkills, merged);

      // Check merged result
      const sharedContent = await fs.readFile(
        path.join(merged, 'shared-skill', SKILL_MD_FILENAME),
        'utf8',
      );
      expect(sharedContent).toBe('# Local Version'); // Local takes precedence

      const globalOnlyContent = await fs.readFile(
        path.join(merged, 'global-only', SKILL_MD_FILENAME),
        'utf8',
      );
      expect(globalOnlyContent).toBe('# Global Only');

      const localOnlyContent = await fs.readFile(
        path.join(merged, 'local-only', SKILL_MD_FILENAME),
        'utf8',
      );
      expect(localOnlyContent).toBe('# Local Only');
    });
  });

  describe('propagateSkills with global skills', () => {
    it('propagates global skills when no local skills exist', async () => {
      const projectRoot = path.join(tmpDir, 'project');
      await fs.mkdir(projectRoot, { recursive: true });

      // Set up global skill
      const globalSkillsDir = path.join(globalDir, 'skills', 'axe');
      await fs.mkdir(globalSkillsDir, { recursive: true });
      await fs.writeFile(
        path.join(globalSkillsDir, SKILL_MD_FILENAME),
        '# AXe Skill',
      );

      const agents = [createMockAgent('claude', 'Claude Code', true)];

      await propagateSkills(projectRoot, agents, true, false, false, false);

      // Check that the skill was propagated to .claude/skills
      const claudeSkillContent = await fs.readFile(
        path.join(projectRoot, CLAUDE_SKILLS_PATH, 'axe', SKILL_MD_FILENAME),
        'utf8',
      );
      expect(claudeSkillContent).toBe('# AXe Skill');
    });

    it('merges local and global skills with local taking precedence', async () => {
      const projectRoot = path.join(tmpDir, 'project');
      const localSkillsDir = path.join(projectRoot, '.ruler', 'skills');

      // Set up global skill
      const globalSkill = path.join(globalDir, 'skills', 'shared');
      await fs.mkdir(globalSkill, { recursive: true });
      await fs.writeFile(path.join(globalSkill, SKILL_MD_FILENAME), '# Global');

      const globalOnly = path.join(globalDir, 'skills', 'global-only');
      await fs.mkdir(globalOnly, { recursive: true });
      await fs.writeFile(path.join(globalOnly, SKILL_MD_FILENAME), '# Global Only');

      // Set up local skill that overrides global
      const localSkill = path.join(localSkillsDir, 'shared');
      await fs.mkdir(localSkill, { recursive: true });
      await fs.writeFile(path.join(localSkill, SKILL_MD_FILENAME), '# Local');

      const agents = [createMockAgent('claude', 'Claude Code', true)];

      await propagateSkills(projectRoot, agents, true, false, false, false);

      // Local overrides global
      const sharedContent = await fs.readFile(
        path.join(projectRoot, CLAUDE_SKILLS_PATH, 'shared', SKILL_MD_FILENAME),
        'utf8',
      );
      expect(sharedContent).toBe('# Local');

      // Global-only skill is also propagated
      const globalOnlyContent = await fs.readFile(
        path.join(projectRoot, CLAUDE_SKILLS_PATH, 'global-only', SKILL_MD_FILENAME),
        'utf8',
      );
      expect(globalOnlyContent).toBe('# Global Only');
    });

    it('skips global skills when localOnly is true', async () => {
      const projectRoot = path.join(tmpDir, 'project');
      await fs.mkdir(projectRoot, { recursive: true });

      // Set up global skill only (no local skills)
      const globalSkill = path.join(globalDir, 'skills', 'global-skill');
      await fs.mkdir(globalSkill, { recursive: true });
      await fs.writeFile(path.join(globalSkill, SKILL_MD_FILENAME), '# Global');

      const agents = [createMockAgent('claude', 'Claude Code', true)];

      await propagateSkills(projectRoot, agents, true, false, false, true);

      // .claude/skills should NOT exist since localOnly=true and there are no local skills
      await expect(
        fs.access(path.join(projectRoot, CLAUDE_SKILLS_PATH)),
      ).rejects.toThrow();
    });
  });
});
