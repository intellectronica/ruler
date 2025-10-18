import * as path from 'path';
import * as os from 'os';
import { promises as fs } from 'fs';
import { execSync } from 'child_process';

describe('Command Propagation Integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-cmd-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function setupTestProject() {
    // Create .ruler directory
    const rulerDir = path.join(tempDir, '.ruler');
    await fs.mkdir(rulerDir, { recursive: true });

    // Create commands directory
    const commandsDir = path.join(rulerDir, 'commands');
    await fs.mkdir(commandsDir, { recursive: true });

    // Create sample command files
    await fs.writeFile(
      path.join(commandsDir, 'pr-review.md'),
      '# PR Review Command\n\nReview this pull request for:\n- Code quality\n- Best practices\n- Security issues',
    );

    await fs.writeFile(
      path.join(commandsDir, 'generate-tests.md'),
      '# Generate Tests\n\nGenerate comprehensive unit tests for the current file.',
    );

    // Create a simple rule file
    await fs.writeFile(
      path.join(rulerDir, 'rules.md'),
      '# Project Rules\n\nFollow best practices.',
    );

    // Create ruler.toml with command configurations
    const tomlContent = `
default_agents = ["claude", "cursor", "codex", "augmentcode", "windsurf"]

[commands.review_code]
name = "review_code"
description = "Review code for best practices"
prompt_file = "commands/pr-review.md"
type = "slash"

[commands.generate_tests]
name = "generate_tests"
description = "Generate comprehensive tests"
prompt_file = "commands/generate-tests.md"
type = "prompt-file"
`;

    await fs.writeFile(path.join(rulerDir, 'ruler.toml'), tomlContent);
  }

  function runRuler(args: string[] = []): string {
    const cmd = `node ${path.join(__dirname, '../../dist/cli/index.js')} ${args.join(' ')}`;
    try {
      return execSync(cmd, {
        cwd: tempDir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    } catch (error) {
      if (error instanceof Error && 'stdout' in error) {
        return (error as { stdout: string }).stdout;
      }
      throw error;
    }
  }

  it('should propagate commands to all supported agents', async () => {
    await setupTestProject();

    // Run ruler apply
    runRuler(['apply']);

    // Verify Claude commands
    const claudeCommandDir = path.join(tempDir, '.claude', 'commands');
    expect(
      await fs
        .access(claudeCommandDir)
        .then(() => true)
        .catch(() => false),
    ).toBe(true);

    const claudeReviewCmd = await fs.readFile(
      path.join(claudeCommandDir, 'review_code.md'),
      'utf-8',
    );
    expect(claudeReviewCmd).toContain('PR Review Command');
    expect(claudeReviewCmd).toContain('Code quality');

    const claudeTestCmd = await fs.readFile(
      path.join(claudeCommandDir, 'generate_tests.md'),
      'utf-8',
    );
    expect(claudeTestCmd).toContain('Generate Tests');

    // Verify Cursor commands
    const cursorCommandDir = path.join(tempDir, '.cursor', 'commands');
    expect(
      await fs
        .access(cursorCommandDir)
        .then(() => true)
        .catch(() => false),
    ).toBe(true);

    const cursorReviewCmd = await fs.readFile(
      path.join(cursorCommandDir, 'review_code.md'),
      'utf-8',
    );
    expect(cursorReviewCmd).toContain('PR Review Command');

    // Verify Codex prompts
    const codexPromptsDir = path.join(tempDir, '.codex', 'prompts');
    expect(
      await fs
        .access(codexPromptsDir)
        .then(() => true)
        .catch(() => false),
    ).toBe(true);

    const codexReviewCmd = await fs.readFile(
      path.join(codexPromptsDir, 'review_code.md'),
      'utf-8',
    );
    expect(codexReviewCmd).toContain('PR Review Command');

    // Verify Augment commands
    const augmentCommandDir = path.join(tempDir, '.augment', 'commands');
    expect(
      await fs
        .access(augmentCommandDir)
        .then(() => true)
        .catch(() => false),
    ).toBe(true);

    const augmentReviewCmd = await fs.readFile(
      path.join(augmentCommandDir, 'review_code.md'),
      'utf-8',
    );
    expect(augmentReviewCmd).toContain('PR Review Command');

    // Verify Windsurf workflows
    const windsurfWorkflowsDir = path.join(tempDir, '.windsurf', 'workflows');
    expect(
      await fs
        .access(windsurfWorkflowsDir)
        .then(() => true)
        .catch(() => false),
    ).toBe(true);

    const windsurfReviewCmd = await fs.readFile(
      path.join(windsurfWorkflowsDir, 'review_code.md'),
      'utf-8',
    );
    expect(windsurfReviewCmd).toContain('PR Review Command');
  });

  it('should create backup files when applying commands', async () => {
    await setupTestProject();

    // Run ruler apply twice to create backups
    runRuler(['apply']);
    runRuler(['apply']);

    // Verify backup files exist
    const claudeBackup = path.join(
      tempDir,
      '.claude',
      'commands',
      'review_code.md.bak',
    );
    expect(
      await fs
        .access(claudeBackup)
        .then(() => true)
        .catch(() => false),
    ).toBe(true);
  });

  it('should skip command processing when no commands defined', async () => {
    // Setup project without commands
    const rulerDir = path.join(tempDir, '.ruler');
    await fs.mkdir(rulerDir, { recursive: true });
    await fs.writeFile(path.join(rulerDir, 'rules.md'), '# Project Rules');
    await fs.writeFile(
      path.join(rulerDir, 'ruler.toml'),
      'default_agents = ["claude"]',
    );

    const output = runRuler(['apply', '--verbose']);

    // Verify no command directories were created
    const claudeCommandDir = path.join(tempDir, '.claude', 'commands');
    expect(
      await fs
        .access(claudeCommandDir)
        .then(() => true)
        .catch(() => false),
    ).toBe(false);
  });

  it('should handle missing command files gracefully', async () => {
    const rulerDir = path.join(tempDir, '.ruler');
    await fs.mkdir(rulerDir, { recursive: true });
    await fs.writeFile(path.join(rulerDir, 'rules.md'), '# Project Rules');

    // Create ruler.toml with command that references non-existent file
    const tomlContent = `
default_agents = ["claude"]

[commands.missing_cmd]
name = "missing_cmd"
description = "Command with missing file"
prompt_file = "commands/nonexistent.md"
type = "slash"
`;

    await fs.writeFile(path.join(rulerDir, 'ruler.toml'), tomlContent);

    // Should not throw and should complete successfully
    const output = runRuler(['apply', '--verbose']);
    expect(output).toContain('completed successfully');

    // Verify no command files were created due to the error
    const claudeCommandDir = path.join(tempDir, '.claude', 'commands');
    const hasCommandDir = await fs
      .access(claudeCommandDir)
      .then(() => true)
      .catch(() => false);

    if (hasCommandDir) {
      // If directory exists, it should be empty or not contain the missing command
      const files = await fs.readdir(claudeCommandDir);
      expect(files).not.toContain('missing_cmd.md');
    }
  });

  it('should support dry-run mode for commands', async () => {
    await setupTestProject();

    runRuler(['apply', '--dry-run']);

    // Verify no command files were created
    const claudeCommandDir = path.join(tempDir, '.claude', 'commands');
    expect(
      await fs
        .access(claudeCommandDir)
        .then(() => true)
        .catch(() => false),
    ).toBe(false);
  });

  it('should add command directories to .gitignore', async () => {
    await setupTestProject();

    runRuler(['apply']);

    const gitignorePath = path.join(tempDir, '.gitignore');
    const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');

    expect(gitignoreContent).toContain('.claude/commands');
    expect(gitignoreContent).toContain('.cursor/commands');
    expect(gitignoreContent).toContain('.codex/prompts');
    expect(gitignoreContent).toContain('.augment/commands');
    expect(gitignoreContent).toContain('.windsurf/workflows');
  });

  it('should handle command files in subdirectories', async () => {
    const rulerDir = path.join(tempDir, '.ruler');
    await fs.mkdir(rulerDir, { recursive: true });

    // Create nested command directory
    const nestedDir = path.join(rulerDir, 'commands', 'workflows');
    await fs.mkdir(nestedDir, { recursive: true });

    await fs.writeFile(path.join(nestedDir, 'deploy.md'), '# Deploy Workflow');

    await fs.writeFile(path.join(rulerDir, 'rules.md'), '# Project Rules');

    const tomlContent = `
default_agents = ["claude"]

[commands.deploy]
name = "deploy"
description = "Deployment workflow"
prompt_file = "commands/workflows/deploy.md"
type = "workflow"
`;

    await fs.writeFile(path.join(rulerDir, 'ruler.toml'), tomlContent);

    runRuler(['apply']);

    const claudeDeployCmd = await fs.readFile(
      path.join(tempDir, '.claude', 'commands', 'deploy.md'),
      'utf-8',
    );
    expect(claudeDeployCmd).toContain('Deploy Workflow');
  });

  it('should apply commands only to agents that support them', async () => {
    const rulerDir = path.join(tempDir, '.ruler');
    const commandsDir = path.join(rulerDir, 'commands');
    await fs.mkdir(commandsDir, { recursive: true });

    await fs.writeFile(path.join(commandsDir, 'review.md'), '# Review');
    await fs.writeFile(path.join(rulerDir, 'rules.md'), '# Rules');

    const tomlContent = `
# Include an agent that doesn't support commands (e.g., aider)
default_agents = ["claude", "aider"]

[commands.review]
name = "review"
description = "Review code"
prompt_file = "commands/review.md"
type = "slash"
`;

    await fs.writeFile(path.join(rulerDir, 'ruler.toml'), tomlContent);

    const output = runRuler(['apply', '--verbose']);

    // Claude should have the command
    const claudeCommandDir = path.join(tempDir, '.claude', 'commands');
    expect(
      await fs
        .access(claudeCommandDir)
        .then(() => true)
        .catch(() => false),
    ).toBe(true);

    // Aider should not have a commands directory (doesn't support commands)
    // This is just to verify the agent doesn't crash
  });
});
