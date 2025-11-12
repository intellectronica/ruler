import * as fs from 'fs/promises';
import * as path from 'path';
import { setupTestProject, teardownTestProject } from '../../harness';

describe('Skills Gitignore Paths', () => {
  let testProject: { projectRoot: string };

  beforeEach(async () => {
    testProject = await setupTestProject();
  });

  afterEach(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('gitignores .claude/skills when generated from .claude/rules', async () => {
    const { projectRoot } = testProject;
    const { getSkillsGitignorePaths } = await import('../../../src/core/SkillsProcessor');

    // Create .claude/rules and .claude/skills
    const claudeDir = path.join(projectRoot, '.claude');
    const rulesDir = path.join(claudeDir, 'rules');
    const skillsDir = path.join(claudeDir, 'skills');

    await fs.mkdir(rulesDir, { recursive: true });
    await fs.mkdir(skillsDir, { recursive: true });

    // Create a dummy rule file
    await fs.writeFile(path.join(rulesDir, 'test.mdc'), '# Test');
    // Create a dummy skill
    await fs.writeFile(path.join(skillsDir, 'test'), '# Test skill');

    const paths = await getSkillsGitignorePaths(projectRoot);

    // Should include .claude/skills because .claude/rules exists
    expect(paths).toContain(path.join(projectRoot, '.claude', 'skills'));
    // Should always include .skillz
    expect(paths).toContain(path.join(projectRoot, '.skillz'));
  });

  it('does not gitignore .claude/skills when no .claude/rules exists', async () => {
    const { projectRoot } = testProject;
    const { getSkillsGitignorePaths } = await import('../../../src/core/SkillsProcessor');

    // Create .claude/skills WITHOUT .claude/rules
    const claudeDir = path.join(projectRoot, '.claude');
    const skillsDir = path.join(claudeDir, 'skills');

    await fs.mkdir(skillsDir, { recursive: true });
    await fs.writeFile(path.join(skillsDir, 'test'), '# Test skill');

    const paths = await getSkillsGitignorePaths(projectRoot);

    // Should NOT include .claude/skills because .claude/rules doesn't exist
    expect(paths).not.toContain(path.join(projectRoot, '.claude', 'skills'));
    // Should always include .skillz
    expect(paths).toContain(path.join(projectRoot, '.skillz'));
  });

  it('gitignores .claude/skills when using .ruler/skills', async () => {
    const { projectRoot } = testProject;
    const { getSkillsGitignorePaths } = await import('../../../src/core/SkillsProcessor');

    // Create .ruler/skills
    const rulerDir = path.join(projectRoot, '.ruler');
    const skillsDir = path.join(rulerDir, 'skills');

    await fs.mkdir(skillsDir, { recursive: true });
    await fs.writeFile(path.join(skillsDir, 'test'), '# Test skill');

    const paths = await getSkillsGitignorePaths(projectRoot);

    // Should include .claude/skills (generated copy)
    expect(paths).toContain(path.join(projectRoot, '.claude', 'skills'));
    // Should always include .skillz
    expect(paths).toContain(path.join(projectRoot, '.skillz'));
  });
});
