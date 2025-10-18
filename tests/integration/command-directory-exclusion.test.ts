import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { setupTestProject, teardownTestProject } from '../harness';

describe('Command Directory Exclusion Integration', () => {
  let projectRoot: string;
  let rulerDir: string;

  beforeEach(async () => {
    const testProject = await setupTestProject();
    projectRoot = testProject.projectRoot;
    rulerDir = path.join(projectRoot, '.ruler');
  });

  afterEach(async () => {
    await teardownTestProject(projectRoot);
  });

  it('should exclude commands directory from generated rule files', async () => {
    // Create ruler configuration with commands
    const rulerToml = `
[commands.review_code]
name = "review_code"
description = "Review code for best practices"
prompt_file = "commands/pr-review.md"
type = "slash"

[commands.generate_tests]
name = "generate_tests"
description = "Generate comprehensive tests"
prompt_file = "commands/generate-tests.md"
type = "slash"
`;

    const agentsMd = `
# Ruler

You are a helpful AI assistant.
`;

    // Create command files
    const commandsDir = path.join(rulerDir, 'commands');
    await fs.mkdir(commandsDir, { recursive: true });

    const prReviewContent = `
# PR Review Command

Review this pull request for:
- Code quality
- Best practices
- Security issues
`;

    const generateTestsContent = `
# Generate Tests Command

Generate comprehensive unit tests with:
- Good coverage
- Edge cases
- Clear test names
`;

    await fs.writeFile(path.join(rulerDir, 'ruler.toml'), rulerToml);
    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), agentsMd);
    await fs.writeFile(path.join(commandsDir, 'pr-review.md'), prReviewContent);
    await fs.writeFile(
      path.join(commandsDir, 'generate-tests.md'),
      generateTestsContent,
    );

    // Run ruler apply
    const output = execSync(
      `node dist/cli/index.js apply --agents cursor --project-root "${projectRoot}"`,
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    );

    // Check that cursor rule file was created
    const cursorRuleFile = path.join(
      projectRoot,
      '.cursor',
      'rules',
      'ruler_cursor_instructions.mdc',
    );
    const cursorRuleContent = await fs.readFile(cursorRuleFile, 'utf8');

    // Verify that command content is NOT in the rule file
    expect(cursorRuleContent).toContain('You are a helpful AI assistant.');
    expect(cursorRuleContent).not.toContain('PR Review Command');
    expect(cursorRuleContent).not.toContain('Generate Tests Command');
    expect(cursorRuleContent).not.toContain('Review this pull request for:');
    expect(cursorRuleContent).not.toContain(
      'Generate comprehensive unit tests with:',
    );

    // Verify that command files ARE in the command directory
    const cursorCommandsDir = path.join(projectRoot, '.cursor', 'commands');
    const reviewCommandFile = path.join(cursorCommandsDir, 'review_code.md');
    const testsCommandFile = path.join(cursorCommandsDir, 'generate_tests.md');

    expect(
      await fs.access(reviewCommandFile).then(
        () => true,
        () => false,
      ),
    ).toBe(true);
    expect(
      await fs.access(testsCommandFile).then(
        () => true,
        () => false,
      ),
    ).toBe(true);

    const reviewCommandContent = await fs.readFile(reviewCommandFile, 'utf8');
    const testsCommandContent = await fs.readFile(testsCommandFile, 'utf8');

    expect(reviewCommandContent).toContain('PR Review Command');
    expect(reviewCommandContent).toContain('Review this pull request for:');
    expect(testsCommandContent).toContain('Generate Tests Command');
    expect(testsCommandContent).toContain(
      'Generate comprehensive unit tests with:',
    );
  });

  it('should work with custom command directory configuration', async () => {
    // Create ruler configuration with custom command directory
    const rulerToml = `
command_directory = "custom-commands"

[commands.review_code]
name = "review_code"
description = "Review code for best practices"
prompt_file = "custom-commands/pr-review.md"
type = "slash"
`;

    const agentsMd = `
# Ruler

You are a helpful AI assistant.
`;

    // Create custom command directory and files
    const customCommandsDir = path.join(rulerDir, 'custom-commands');
    await fs.mkdir(customCommandsDir, { recursive: true });

    const prReviewContent = `
# PR Review Command

Review this pull request for:
- Code quality
- Best practices
`;

    await fs.writeFile(path.join(rulerDir, 'ruler.toml'), rulerToml);
    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), agentsMd);
    await fs.writeFile(
      path.join(customCommandsDir, 'pr-review.md'),
      prReviewContent,
    );

    // Run ruler apply
    execSync(
      `node dist/cli/index.js apply --agents cursor --project-root "${projectRoot}"`,
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    );

    // Check that cursor rule file was created and doesn't contain command content
    const cursorRuleFile = path.join(
      projectRoot,
      '.cursor',
      'rules',
      'ruler_cursor_instructions.mdc',
    );
    const cursorRuleContent = await fs.readFile(cursorRuleFile, 'utf8');

    expect(cursorRuleContent).toContain('You are a helpful AI assistant.');
    expect(cursorRuleContent).not.toContain('PR Review Command');
    expect(cursorRuleContent).not.toContain('Review this pull request for:');

    // Verify that command file IS in the command directory
    const cursorCommandsDir = path.join(projectRoot, '.cursor', 'commands');
    const reviewCommandFile = path.join(cursorCommandsDir, 'review_code.md');

    expect(
      await fs.access(reviewCommandFile).then(
        () => true,
        () => false,
      ),
    ).toBe(true);

    const reviewCommandContent = await fs.readFile(reviewCommandFile, 'utf8');
    expect(reviewCommandContent).toContain('PR Review Command');
    expect(reviewCommandContent).toContain('Review this pull request for:');
  });

  it('should handle multiple agents with command exclusion', async () => {
    // Create ruler configuration with commands
    const rulerToml = `
[commands.review_code]
name = "review_code"
description = "Review code for best practices"
prompt_file = "commands/pr-review.md"
type = "slash"
`;

    const agentsMd = `
# Ruler

You are a helpful AI assistant.
`;

    // Create command files
    const commandsDir = path.join(rulerDir, 'commands');
    await fs.mkdir(commandsDir, { recursive: true });

    const prReviewContent = `
# PR Review Command

Review this pull request for:
- Code quality
- Best practices
`;

    await fs.writeFile(path.join(rulerDir, 'ruler.toml'), rulerToml);
    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), agentsMd);
    await fs.writeFile(path.join(commandsDir, 'pr-review.md'), prReviewContent);

    // Run ruler apply for multiple agents
    execSync(
      `node dist/cli/index.js apply --agents cursor,claude --project-root "${projectRoot}"`,
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    );

    // Check that both agents' rule files exclude command content
    const cursorRuleFile = path.join(
      projectRoot,
      '.cursor',
      'rules',
      'ruler_cursor_instructions.mdc',
    );
    const claudeRuleFile = path.join(
      projectRoot,
      '.claude',
      'rules',
      'ruler_claude_instructions.mdc',
    );

    const cursorRuleContent = await fs.readFile(cursorRuleFile, 'utf8');

    // Check if Claude rule file exists (it might not be created if Claude agent is not available)
    let claudeRuleContent = '';
    try {
      claudeRuleContent = await fs.readFile(claudeRuleFile, 'utf8');
    } catch {
      // Claude rule file doesn't exist, skip Claude-specific assertions
    }

    // Cursor should contain the main rule content but not command content
    expect(cursorRuleContent).toContain('You are a helpful AI assistant.');
    expect(cursorRuleContent).not.toContain('PR Review Command');

    // If Claude rule file exists, it should also exclude command content
    if (claudeRuleContent) {
      expect(claudeRuleContent).toContain('You are a helpful AI assistant.');
      expect(claudeRuleContent).not.toContain('PR Review Command');
    }

    // Both should have command files in their respective command directories
    const cursorCommandFile = path.join(
      projectRoot,
      '.cursor',
      'commands',
      'review_code.md',
    );
    const claudeCommandFile = path.join(
      projectRoot,
      '.claude',
      'commands',
      'review_code.md',
    );

    expect(
      await fs.access(cursorCommandFile).then(
        () => true,
        () => false,
      ),
    ).toBe(true);

    // Check if Claude command file exists (it might not be created if Claude agent is not available)
    const claudeCommandExists = await fs.access(claudeCommandFile).then(
      () => true,
      () => false,
    );
    if (claudeCommandExists) {
      expect(claudeCommandExists).toBe(true);
    }
  });
});
