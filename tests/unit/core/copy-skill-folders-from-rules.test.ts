import * as fs from 'fs/promises';
import * as path from 'path';
import { setupTestProject, teardownTestProject } from '../../harness';

describe('Copy Skill Folders from Rules to Skills', () => {
  let testProject: { projectRoot: string };

  beforeEach(async () => {
    testProject = await setupTestProject();
  });

  afterEach(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('copies skill folder with SKILL.md from rules to skills', async () => {
    const { projectRoot } = testProject;
    const { copySkillFoldersFromRules } = await import(
      '../../../src/core/SkillsProcessor'
    );

    // Create .claude directory structure
    const skillerDir = path.join(projectRoot, '.claude');
    const rulesDir = path.join(skillerDir, 'rules');
    const skillFolder = path.join(rulesDir, 'my-skill');
    await fs.mkdir(skillFolder, { recursive: true });

    // Create SKILL.md and helper files
    const skillContent = `---
name: my-skill
description: A test skill
---

# My Skill

Use this skill for testing.
`;
    await fs.writeFile(path.join(skillFolder, 'SKILL.md'), skillContent);
    await fs.writeFile(
      path.join(skillFolder, 'helper.sh'),
      '#!/bin/bash\necho "Helper"',
    );

    // Copy skill folders
    await copySkillFoldersFromRules(skillerDir, false, false);

    // Verify skill folder was copied to skills
    const targetDir = path.join(skillerDir, 'skills', 'my-skill');
    const copiedSkillMd = await fs.readFile(
      path.join(targetDir, 'SKILL.md'),
      'utf8',
    );
    expect(copiedSkillMd).toBe(skillContent);

    const copiedHelper = await fs.readFile(
      path.join(targetDir, 'helper.sh'),
      'utf8',
    );
    expect(copiedHelper).toBe('#!/bin/bash\necho "Helper"');
  });

  it('handles nested skill folders in rules', async () => {
    const { projectRoot } = testProject;
    const { copySkillFoldersFromRules } = await import(
      '../../../src/core/SkillsProcessor'
    );

    // Create .claude directory structure with nested skill folders
    const skillerDir = path.join(projectRoot, '.claude');
    const rulesDir = path.join(skillerDir, 'rules');

    // Create nested structure: rules/category/nested-skill/SKILL.md
    const nestedSkillFolder = path.join(rulesDir, 'category', 'nested-skill');
    await fs.mkdir(nestedSkillFolder, { recursive: true });

    const skillContent = `---
name: nested-skill
description: A nested skill
---

# Nested Skill
`;
    await fs.writeFile(path.join(nestedSkillFolder, 'SKILL.md'), skillContent);

    // Copy skill folders
    await copySkillFoldersFromRules(skillerDir, false, false);

    // Verify nested skill folder was copied (using folder name, not full path)
    const targetDir = path.join(skillerDir, 'skills', 'nested-skill');
    const copiedSkillMd = await fs.readFile(
      path.join(targetDir, 'SKILL.md'),
      'utf8',
    );
    expect(copiedSkillMd).toBe(skillContent);
  });

  it('does nothing when no skill folders exist in rules', async () => {
    const { projectRoot } = testProject;
    const { copySkillFoldersFromRules } = await import(
      '../../../src/core/SkillsProcessor'
    );

    // Create .claude directory with empty rules
    const skillerDir = path.join(projectRoot, '.claude');
    const rulesDir = path.join(skillerDir, 'rules');
    await fs.mkdir(rulesDir, { recursive: true });

    // Create a folder without SKILL.md
    await fs.mkdir(path.join(rulesDir, 'not-a-skill'), { recursive: true });
    await fs.writeFile(
      path.join(rulesDir, 'not-a-skill', 'readme.txt'),
      'Not a skill',
    );

    // Copy skill folders - should do nothing
    await copySkillFoldersFromRules(skillerDir, false, false);

    // Verify skills directory was not created or is empty
    const skillsDir = path.join(skillerDir, 'skills');
    try {
      const entries = await fs.readdir(skillsDir);
      expect(entries.length).toBe(0);
    } catch {
      // skills directory doesn't exist - that's fine
    }
  });

  it('handles dry-run mode correctly', async () => {
    const { projectRoot } = testProject;
    const { copySkillFoldersFromRules } = await import(
      '../../../src/core/SkillsProcessor'
    );

    // Create .claude directory structure
    const skillerDir = path.join(projectRoot, '.claude');
    const rulesDir = path.join(skillerDir, 'rules');
    const skillFolder = path.join(rulesDir, 'dry-run-skill');
    await fs.mkdir(skillFolder, { recursive: true });

    const skillContent = `---
name: dry-run-skill
description: Test dry run
---

# Dry Run Skill
`;
    await fs.writeFile(path.join(skillFolder, 'SKILL.md'), skillContent);

    // Copy skill folders in dry-run mode
    await copySkillFoldersFromRules(skillerDir, true, true);

    // Verify skill folder was NOT copied (dry run)
    const targetDir = path.join(skillerDir, 'skills', 'dry-run-skill');
    await expect(fs.access(targetDir)).rejects.toThrow();
  });

  it('copies multiple skill folders', async () => {
    const { projectRoot } = testProject;
    const { copySkillFoldersFromRules } = await import(
      '../../../src/core/SkillsProcessor'
    );

    // Create .claude directory with multiple skill folders
    const skillerDir = path.join(projectRoot, '.claude');
    const rulesDir = path.join(skillerDir, 'rules');

    // Create first skill
    const skill1 = path.join(rulesDir, 'skill-one');
    await fs.mkdir(skill1, { recursive: true });
    await fs.writeFile(
      path.join(skill1, 'SKILL.md'),
      '---\nname: skill-one\n---\n\n# Skill One',
    );

    // Create second skill
    const skill2 = path.join(rulesDir, 'skill-two');
    await fs.mkdir(skill2, { recursive: true });
    await fs.writeFile(
      path.join(skill2, 'SKILL.md'),
      '---\nname: skill-two\n---\n\n# Skill Two',
    );

    // Copy skill folders
    await copySkillFoldersFromRules(skillerDir, false, false);

    // Verify both skills were copied
    const skillsDir = path.join(skillerDir, 'skills');
    const entries = await fs.readdir(skillsDir);
    expect(entries.sort()).toEqual(['skill-one', 'skill-two']);
  });

  it('copies skill folder with subdirectories', async () => {
    const { projectRoot } = testProject;
    const { copySkillFoldersFromRules } = await import(
      '../../../src/core/SkillsProcessor'
    );

    // Create .claude directory structure
    const skillerDir = path.join(projectRoot, '.claude');
    const rulesDir = path.join(skillerDir, 'rules');
    const skillFolder = path.join(rulesDir, 'complex-skill');
    await fs.mkdir(skillFolder, { recursive: true });

    // Create SKILL.md
    await fs.writeFile(
      path.join(skillFolder, 'SKILL.md'),
      '---\nname: complex-skill\n---\n\n# Complex Skill',
    );

    // Create subdirectory with files
    const subDir = path.join(skillFolder, 'templates');
    await fs.mkdir(subDir, { recursive: true });
    await fs.writeFile(
      path.join(subDir, 'template.txt'),
      'Template content',
    );

    // Copy skill folders
    await copySkillFoldersFromRules(skillerDir, false, false);

    // Verify subdirectory was copied
    const targetSubDir = path.join(
      skillerDir,
      'skills',
      'complex-skill',
      'templates',
    );
    const templateContent = await fs.readFile(
      path.join(targetSubDir, 'template.txt'),
      'utf8',
    );
    expect(templateContent).toBe('Template content');
  });

  it('does nothing when rules directory does not exist', async () => {
    const { projectRoot } = testProject;
    const { copySkillFoldersFromRules } = await import(
      '../../../src/core/SkillsProcessor'
    );

    // Create .claude directory without rules
    const skillerDir = path.join(projectRoot, '.claude');
    await fs.mkdir(skillerDir, { recursive: true });

    // Should not throw
    await expect(
      copySkillFoldersFromRules(skillerDir, false, false),
    ).resolves.not.toThrow();
  });
});
