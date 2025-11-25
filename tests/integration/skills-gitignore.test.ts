import * as fs from 'fs/promises';
import * as path from 'path';
import { setupTestProject, teardownTestProject } from '../harness';
import { applyAllAgentConfigs } from '../../src/lib';

describe('Skills Gitignore Integration', () => {
  let testProject: { projectRoot: string };

  beforeEach(async () => {
    testProject = await setupTestProject();
  });

  afterEach(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('should add .claude/skills to gitignore when generate_from_rules is true', async () => {
    const { projectRoot } = testProject;

    // Create .claude directory with skiller.toml that has generate_from_rules = true
    const skillerDir = path.join(projectRoot, '.claude');
    await fs.mkdir(skillerDir, { recursive: true });

    const tomlContent = `
[skills]
enabled = true
generate_from_rules = true

[gitignore]
enabled = true
`;
    await fs.writeFile(path.join(skillerDir, 'skiller.toml'), tomlContent);

    // Create minimal AGENTS.md
    await fs.writeFile(path.join(skillerDir, 'AGENTS.md'), '# Test');

    // Run apply
    await applyAllAgentConfigs(
      projectRoot,
      ['claude'], // Only run claude agent
      undefined, // configPath
      false, // cliMcpEnabled
      undefined, // cliMcpStrategy
      true, // cliGitignoreEnabled
      true, // verbose - enable to see what's happening
      false, // dryRun
      true, // localOnly
      false, // nested
      false, // cliBackupEnabled
      true, // skillsEnabled
    );

    // Check gitignore content
    const gitignorePath = path.join(projectRoot, '.gitignore');
    const gitignoreContent = await fs.readFile(gitignorePath, 'utf8');

    // Should contain .claude/skills
    expect(gitignoreContent).toContain('.claude/skills');
  });

  it('should NOT add .claude/skills to gitignore when generate_from_rules is false and no .claude/rules exists', async () => {
    const { projectRoot } = testProject;

    // Create .claude directory with skiller.toml that has generate_from_rules = false
    const skillerDir = path.join(projectRoot, '.claude');
    await fs.mkdir(skillerDir, { recursive: true });

    const tomlContent = `
[skills]
enabled = true
generate_from_rules = false

[gitignore]
enabled = true
`;
    await fs.writeFile(path.join(skillerDir, 'skiller.toml'), tomlContent);

    // Create minimal AGENTS.md
    await fs.writeFile(path.join(skillerDir, 'AGENTS.md'), '# Test');

    // Run apply
    await applyAllAgentConfigs(
      projectRoot,
      ['claude'],
      undefined,
      false,
      undefined,
      true,
      false,
      false,
      true,
      false,
      false,
      true,
    );

    // Check gitignore content
    const gitignorePath = path.join(projectRoot, '.gitignore');
    let gitignoreContent = '';
    try {
      gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
    } catch {
      // Gitignore might not exist if no paths were generated
    }

    // Should NOT contain .claude/skills
    expect(gitignoreContent).not.toContain('.claude/skills');
  });
});
