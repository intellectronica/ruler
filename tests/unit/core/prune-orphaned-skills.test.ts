import * as fs from 'fs/promises';
import * as path from 'path';
import { generateSkillsFromRules } from '../../../src/core/SkillsProcessor';
import { setupTestProject, teardownTestProject } from '../../harness';

describe('pruneOrphanedSkills', () => {
  let testProject: { projectRoot: string };

  beforeEach(async () => {
    testProject = await setupTestProject();
  });

  afterEach(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('auto-deletes orphaned skills when prune = true', async () => {
    const { projectRoot } = testProject;
    const skillerDir = path.join(projectRoot, '.claude');

    // Create .claude directory structure
    await fs.mkdir(path.join(skillerDir, 'rules'), { recursive: true });
    await fs.mkdir(path.join(skillerDir, 'skills', 'orphan-skill'), {
      recursive: true,
    });

    // Create an orphan skill (not generated from any .mdc)
    await fs.writeFile(
      path.join(skillerDir, 'skills', 'orphan-skill', 'SKILL.md'),
      '---\nname: orphan-skill\ndescription: An orphan\n---\n'
    );

    // Create a valid .mdc file
    const mdcContent = `---
description: Valid skill
alwaysApply: false
---

# Valid
`;
    await fs.writeFile(path.join(skillerDir, 'rules', 'valid.mdc'), mdcContent);

    // Generate skills with prune = true
    await generateSkillsFromRules(projectRoot, skillerDir, false, false, true);

    // Verify orphan was deleted
    const orphanPath = path.join(
      skillerDir,
      'skills',
      'orphan-skill',
      'SKILL.md'
    );
    await expect(fs.access(orphanPath)).rejects.toThrow();

    // Verify valid skill still exists
    const validPath = path.join(skillerDir, 'skills', 'valid', 'SKILL.md');
    await expect(fs.access(validPath)).resolves.toBeUndefined();
  });

  it('leaves orphaned skills when prune = false', async () => {
    const { projectRoot } = testProject;
    const skillerDir = path.join(projectRoot, '.claude');

    // Create .claude directory structure
    await fs.mkdir(path.join(skillerDir, 'rules'), { recursive: true });
    await fs.mkdir(path.join(skillerDir, 'skills', 'orphan-skill'), {
      recursive: true,
    });

    // Create an orphan skill
    await fs.writeFile(
      path.join(skillerDir, 'skills', 'orphan-skill', 'SKILL.md'),
      '---\nname: orphan-skill\ndescription: An orphan\n---\n'
    );

    // Create a valid .mdc file
    const mdcContent = `---
description: Valid skill
alwaysApply: false
---

# Valid
`;
    await fs.writeFile(path.join(skillerDir, 'rules', 'valid.mdc'), mdcContent);

    // Generate skills with prune = false
    await generateSkillsFromRules(projectRoot, skillerDir, false, false, false);

    // Verify orphan still exists
    const orphanPath = path.join(
      skillerDir,
      'skills',
      'orphan-skill',
      'SKILL.md'
    );
    await expect(fs.access(orphanPath)).resolves.toBeUndefined();

    // Verify valid skill also exists
    const validPath = path.join(skillerDir, 'skills', 'valid', 'SKILL.md');
    await expect(fs.access(validPath)).resolves.toBeUndefined();
  });

  it('does not delete anything when there are no orphans', async () => {
    const { projectRoot } = testProject;
    const skillerDir = path.join(projectRoot, '.claude');

    // Create .claude directory structure
    await fs.mkdir(path.join(skillerDir, 'rules'), { recursive: true });

    // Create a valid .mdc file
    const mdcContent = `---
description: Valid skill
alwaysApply: false
---

# Valid
`;
    await fs.writeFile(path.join(skillerDir, 'rules', 'valid.mdc'), mdcContent);

    // Generate skills with prune = true (no orphans to delete)
    await generateSkillsFromRules(projectRoot, skillerDir, false, false, true);

    // Verify valid skill exists
    const validPath = path.join(skillerDir, 'skills', 'valid', 'SKILL.md');
    await expect(fs.access(validPath)).resolves.toBeUndefined();
  });

  it('handles multiple orphaned skills', async () => {
    const { projectRoot } = testProject;
    const skillerDir = path.join(projectRoot, '.claude');

    // Create .claude directory structure
    await fs.mkdir(path.join(skillerDir, 'rules'), { recursive: true });
    await fs.mkdir(path.join(skillerDir, 'skills', 'orphan1'), {
      recursive: true,
    });
    await fs.mkdir(path.join(skillerDir, 'skills', 'orphan2'), {
      recursive: true,
    });

    // Create orphan skills
    await fs.writeFile(
      path.join(skillerDir, 'skills', 'orphan1', 'SKILL.md'),
      '---\nname: orphan1\n---\n'
    );
    await fs.writeFile(
      path.join(skillerDir, 'skills', 'orphan2', 'SKILL.md'),
      '---\nname: orphan2\n---\n'
    );

    // Create a valid .mdc file
    const mdcContent = `---
description: Valid skill
alwaysApply: false
---

# Valid
`;
    await fs.writeFile(path.join(skillerDir, 'rules', 'valid.mdc'), mdcContent);

    // Generate skills with prune = true
    await generateSkillsFromRules(projectRoot, skillerDir, false, false, true);

    // Verify both orphans were deleted
    await expect(
      fs.access(path.join(skillerDir, 'skills', 'orphan1'))
    ).rejects.toThrow();
    await expect(
      fs.access(path.join(skillerDir, 'skills', 'orphan2'))
    ).rejects.toThrow();

    // Verify valid skill still exists
    const validPath = path.join(skillerDir, 'skills', 'valid', 'SKILL.md');
    await expect(fs.access(validPath)).resolves.toBeUndefined();
  });

  it('respects dry-run mode when pruning', async () => {
    const { projectRoot } = testProject;
    const skillerDir = path.join(projectRoot, '.claude');

    // Create .claude directory structure
    await fs.mkdir(path.join(skillerDir, 'rules'), { recursive: true });
    await fs.mkdir(path.join(skillerDir, 'skills', 'orphan-skill'), {
      recursive: true,
    });

    // Create an orphan skill
    await fs.writeFile(
      path.join(skillerDir, 'skills', 'orphan-skill', 'SKILL.md'),
      '---\nname: orphan-skill\n---\n'
    );

    // Create a valid .mdc file
    const mdcContent = `---
description: Valid skill
alwaysApply: false
---

# Valid
`;
    await fs.writeFile(path.join(skillerDir, 'rules', 'valid.mdc'), mdcContent);

    // Generate skills with prune = true and dryRun = true
    await generateSkillsFromRules(projectRoot, skillerDir, false, true, true);

    // Verify orphan was NOT deleted (dry run)
    const orphanPath = path.join(
      skillerDir,
      'skills',
      'orphan-skill',
      'SKILL.md'
    );
    await expect(fs.access(orphanPath)).resolves.toBeUndefined();
  });
});
