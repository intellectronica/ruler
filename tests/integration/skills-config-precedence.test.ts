import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { applyAllAgentConfigs } from '../../src/lib';
import { SKILL_MD_FILENAME } from '../../src/constants';

describe('Skills Configuration Precedence', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ruler-skills-config-test-'),
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('honors skills.enabled = false in ruler.toml', async () => {
    // Setup .ruler directory with skills
    const rulerDir = path.join(tmpDir, '.ruler');
    const skillsDir = path.join(rulerDir, 'skills');
    const skill1 = path.join(skillsDir, 'test-skill');

    await fs.mkdir(skill1, { recursive: true });
    await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Test Skill');
    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), '# Test Rules');

    // Create ruler.toml with skills.enabled = false
    await fs.writeFile(
      path.join(rulerDir, 'ruler.toml'),
      `
[skills]
enabled = false
`,
    );

    // Apply without CLI flag (should respect TOML config)
    await applyAllAgentConfigs(
      tmpDir,
      ['claude'], // Just test with one agent
      undefined,
      true,
      undefined,
      undefined,
      false,
      false,
      false,
      false,
      true,
      undefined, // No CLI skills flag
    );

    // Skills should NOT be copied because TOML says enabled = false
    const claudeSkillsDir = path.join(tmpDir, '.claude', 'skills');
    await expect(fs.access(claudeSkillsDir)).rejects.toThrow();
  });

  it('removes previously managed native skills when skills are disabled', async () => {
    const rulerDir = path.join(tmpDir, '.ruler');
    const skillDir = path.join(rulerDir, 'skills', 'test-skill');

    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, SKILL_MD_FILENAME), '# Test Skill');
    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), '# Test Rules');
    await fs.writeFile(
      path.join(rulerDir, 'ruler.toml'),
      `
[skills]
enabled = true
`,
    );

    await applyAllAgentConfigs(
      tmpDir,
      ['claude'],
      undefined,
      true,
      undefined,
      undefined,
      false,
      false,
      false,
      false,
      true,
      undefined,
    );

    const copiedSkill = path.join(
      tmpDir,
      '.claude',
      'skills',
      'test-skill',
      SKILL_MD_FILENAME,
    );
    expect(await fs.readFile(copiedSkill, 'utf8')).toBe('# Test Skill');

    await fs.writeFile(
      path.join(rulerDir, 'ruler.toml'),
      `
[skills]
enabled = false
`,
    );

    await applyAllAgentConfigs(
      tmpDir,
      ['claude'],
      undefined,
      true,
      undefined,
      undefined,
      false,
      false,
      false,
      false,
      true,
      undefined,
    );

    await expect(fs.access(copiedSkill)).rejects.toThrow();
  });

  it('removes nested native skills when child config disables skills', async () => {
    const rootRulerDir = path.join(tmpDir, '.ruler');
    const childRoot = path.join(tmpDir, 'packages', 'core');
    const childRulerDir = path.join(childRoot, '.ruler');
    const childSkillDir = path.join(childRulerDir, 'skills', 'child-skill');

    await fs.mkdir(rootRulerDir, { recursive: true });
    await fs.mkdir(childSkillDir, { recursive: true });
    await fs.writeFile(path.join(rootRulerDir, 'AGENTS.md'), '# Root Rules');
    await fs.writeFile(path.join(childRulerDir, 'AGENTS.md'), '# Child Rules');
    await fs.writeFile(
      path.join(childSkillDir, SKILL_MD_FILENAME),
      '# Child Skill',
    );
    await fs.writeFile(
      path.join(rootRulerDir, 'ruler.toml'),
      `
nested = true

[skills]
enabled = true
`,
    );
    await fs.writeFile(
      path.join(childRulerDir, 'ruler.toml'),
      `
[skills]
enabled = true
`,
    );

    await applyAllAgentConfigs(
      tmpDir,
      ['claude'],
      undefined,
      true,
      undefined,
      undefined,
      false,
      false,
      false,
      true,
      true,
      undefined,
    );

    const copiedSkill = path.join(
      childRoot,
      '.claude',
      'skills',
      'child-skill',
      SKILL_MD_FILENAME,
    );
    expect(await fs.readFile(copiedSkill, 'utf8')).toBe('# Child Skill');

    await fs.writeFile(
      path.join(childRulerDir, 'ruler.toml'),
      `
[skills]
enabled = false
`,
    );

    await applyAllAgentConfigs(
      tmpDir,
      ['claude'],
      undefined,
      true,
      undefined,
      undefined,
      false,
      false,
      false,
      true,
      true,
      undefined,
    );

    await expect(fs.access(copiedSkill)).rejects.toThrow();
  });

  it('honors skills.enabled = true in ruler.toml', async () => {
    // Setup .ruler directory with skills
    const rulerDir = path.join(tmpDir, '.ruler');
    const skillsDir = path.join(rulerDir, 'skills');
    const skill1 = path.join(skillsDir, 'test-skill');

    await fs.mkdir(skill1, { recursive: true });
    await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Test Skill');
    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), '# Test Rules');

    // Create ruler.toml with skills.enabled = true
    await fs.writeFile(
      path.join(rulerDir, 'ruler.toml'),
      `
[skills]
enabled = true
`,
    );

    // Apply without CLI flag (should respect TOML config)
    await applyAllAgentConfigs(
      tmpDir,
      ['claude'], // Just test with one agent
      undefined,
      true,
      undefined,
      undefined,
      false,
      false,
      false,
      false,
      true,
      undefined, // No CLI skills flag
    );

    // Skills SHOULD be copied because TOML says enabled = true
    const claudeSkillsDir = path.join(tmpDir, '.claude', 'skills');
    const copiedSkill = path.join(
      claudeSkillsDir,
      'test-skill',
      SKILL_MD_FILENAME,
    );
    expect(await fs.readFile(copiedSkill, 'utf8')).toBe('# Test Skill');
  });

  it('CLI flag overrides ruler.toml setting', async () => {
    // Setup .ruler directory with skills
    const rulerDir = path.join(tmpDir, '.ruler');
    const skillsDir = path.join(rulerDir, 'skills');
    const skill1 = path.join(skillsDir, 'test-skill');

    await fs.mkdir(skill1, { recursive: true });
    await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Test Skill');
    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), '# Test Rules');

    // Create ruler.toml with skills.enabled = true
    await fs.writeFile(
      path.join(rulerDir, 'ruler.toml'),
      `
[skills]
enabled = true
`,
    );

    // Apply with CLI flag = false (should override TOML)
    await applyAllAgentConfigs(
      tmpDir,
      ['claude'], // Just test with one agent
      undefined,
      true,
      undefined,
      undefined,
      false,
      false,
      false,
      false,
      true,
      false, // CLI: --no-skills
    );

    // Skills should NOT be copied because CLI overrides TOML
    const claudeSkillsDir = path.join(tmpDir, '.claude', 'skills');
    await expect(fs.access(claudeSkillsDir)).rejects.toThrow();
  });

  it('defaults to enabled when no config is set', async () => {
    // Setup .ruler directory with skills
    const rulerDir = path.join(tmpDir, '.ruler');
    const skillsDir = path.join(rulerDir, 'skills');
    const skill1 = path.join(skillsDir, 'test-skill');

    await fs.mkdir(skill1, { recursive: true });
    await fs.writeFile(path.join(skill1, SKILL_MD_FILENAME), '# Test Skill');
    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), '# Test Rules');

    // Create ruler.toml WITHOUT skills section
    await fs.writeFile(path.join(rulerDir, 'ruler.toml'), '');

    // Apply without CLI flag
    await applyAllAgentConfigs(
      tmpDir,
      ['claude'], // Just test with one agent
      undefined,
      true,
      undefined,
      undefined,
      false,
      false,
      false,
      false,
      true,
      undefined, // No CLI skills flag
    );

    // Skills SHOULD be copied because default is enabled
    const claudeSkillsDir = path.join(tmpDir, '.claude', 'skills');
    const copiedSkill = path.join(
      claudeSkillsDir,
      'test-skill',
      SKILL_MD_FILENAME,
    );
    expect(await fs.readFile(copiedSkill, 'utf8')).toBe('# Test Skill');
  });
});
