import * as fs from 'fs/promises';
import * as path from 'path';
import { setupTestProject, teardownTestProject, runRuler } from './harness';

describe('custom commands', () => {
  let testProject: { projectRoot: string };

  beforeEach(async () => {
    testProject = await setupTestProject({
      '.ruler/AGENTS.md': '# Test Rules\n\nSome test rules here.',
      '.ruler/ruler.toml': `
# Test config with custom commands
default_agents = ["copilot", "claude", "cursor", "windsurf"]

[commands.test_command]
name = "test_command"
description = "A test command for validation"
prompt = "Execute a test validation"
type = "prompt-file"

[commands.review_code]
name = "review_code"
description = "Review code for best practices"
prompt = "Please review the current code for best practices, security issues, and potential improvements."
type = "slash"

[commands.generate_docs]
name = "generate_docs"
description = "Generate documentation"
prompt = "Generate comprehensive documentation for the current codebase"
type = "workflow"
metadata = { category = "documentation", priority = "high" }
`,
    });
  });

  afterEach(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('generates Copilot prompt files for custom commands', async () => {
    const { projectRoot } = testProject;
    
    runRuler('apply --agents copilot', projectRoot);
    
    // Check that prompt files were created
    const promptsDir = path.join(projectRoot, '.github', 'copilot', 'prompts');
    const testCommandFile = path.join(promptsDir, 'test_command.md');
    const reviewCodeFile = path.join(promptsDir, 'review_code.md');
    const generateDocsFile = path.join(promptsDir, 'generate_docs.md');
    
    const testCommandExists = await fs.access(testCommandFile).then(() => true).catch(() => false);
    const reviewCodeExists = await fs.access(reviewCodeFile).then(() => true).catch(() => false);
    const generateDocsExists = await fs.access(generateDocsFile).then(() => true).catch(() => false);
    
    expect(testCommandExists).toBe(true);
    expect(reviewCodeExists).toBe(true);
    expect(generateDocsExists).toBe(true);
    
    // Check content of test command file
    const testCommandContent = await fs.readFile(testCommandFile, 'utf8');
    expect(testCommandContent).toContain('Execute a test validation');
    expect(testCommandContent).toContain('A test command for validation');
    
    // Check content of review code file
    const reviewCodeContent = await fs.readFile(reviewCodeFile, 'utf8');
    expect(reviewCodeContent).toContain('Review code for best practices');
    expect(reviewCodeContent).toContain('Please review the current code for best practices');
  });

  it('generates Claude slash commands for custom commands', async () => {
    const { projectRoot } = testProject;
    
    runRuler('apply --agents claude', projectRoot);
    
    // Check that CLAUDE.md contains slash commands
    const claudeFile = path.join(projectRoot, 'CLAUDE.md');
    const claudeContent = await fs.readFile(claudeFile, 'utf8');
    
    expect(claudeContent).toContain('# Custom Slash Commands');
    expect(claudeContent).toContain('/review_code - review_code');
    expect(claudeContent).toContain('Please review the current code for best practices');
  });

  it('generates Cursor custom commands', async () => {
    const { projectRoot } = testProject;
    
    runRuler('apply --agents cursor', projectRoot);
    
    // Check that Cursor rules file contains custom commands
    const cursorFile = path.join(projectRoot, '.cursor/rules/ruler_cursor_instructions.mdc');
    const cursorContent = await fs.readFile(cursorFile, 'utf8');
    
    expect(cursorContent).toContain('# Custom Commands');
    expect(cursorContent).toContain('@review_code - review_code');
    expect(cursorContent).toContain('Please review the current code for best practices');
  });

  it('generates Windsurf workflows for custom commands', async () => {
    const { projectRoot } = testProject;
    
    runRuler('apply --agents windsurf', projectRoot);
    
    // Check that .windsurf/rules/ruler_windsurf_instructions.md contains workflows
    const rulesFile = path.join(projectRoot, '.windsurf/rules/ruler_windsurf_instructions.md');
    const rulesContent = await fs.readFile(rulesFile, 'utf8');
    
    expect(rulesContent).toContain('# Custom Workflows');
    expect(rulesContent).toContain('## Workflow: generate_docs');
    expect(rulesContent).toContain('Generate documentation');
    expect(rulesContent).toContain('Generate comprehensive documentation for the current codebase');
  });

  it('handles commands with metadata correctly', async () => {
    const { projectRoot } = testProject;
    
    runRuler('apply --agents copilot', projectRoot);
    
    // Check that metadata is included in generated files
    const promptsDir = path.join(projectRoot, '.github', 'copilot', 'prompts');
    const generateDocsFile = path.join(promptsDir, 'generate_docs.md');
    
    const generateDocsContent = await fs.readFile(generateDocsFile, 'utf8');
    expect(generateDocsContent).toContain('Generate documentation');
    expect(generateDocsContent).toContain('Generate comprehensive documentation');
  });

  it('works with empty commands configuration', async () => {
    // Create a project without custom commands
    const emptyProject = await setupTestProject({
      '.ruler/AGENTS.md': '# Test Rules\n\nSome test rules here.',
      '.ruler/ruler.toml': 'default_agents = ["copilot"]\n',
    });

    try {
      runRuler('apply --agents copilot', emptyProject.projectRoot);
      
      // Should not create prompts directory if no commands
      const promptsDir = path.join(emptyProject.projectRoot, '.github', 'copilot', 'prompts');
      const promptsDirExists = await fs.access(promptsDir).then(() => true).catch(() => false);
      expect(promptsDirExists).toBe(false);
      
      // Should still create AGENTS.md
      const agentsFile = path.join(emptyProject.projectRoot, 'AGENTS.md');
      const agentsExists = await fs.access(agentsFile).then(() => true).catch(() => false);
      expect(agentsExists).toBe(true);
    } finally {
      await teardownTestProject(emptyProject.projectRoot);
    }
  });

  it('validates command configuration format', async () => {
    // Create a project with invalid command configuration
    const invalidProject = await setupTestProject({
      '.ruler/AGENTS.md': '# Test Rules\n\nSome test rules here.',
      '.ruler/ruler.toml': `
default_agents = ["copilot"]

[commands.invalid_command]
name = "invalid_command"
# Missing description and prompt - should cause validation error
`,
    });

    try {
      // Should throw an error for invalid configuration
      expect(() => {
        runRuler('apply --agents copilot', invalidProject.projectRoot);
      }).toThrow();
    } finally {
      await teardownTestProject(invalidProject.projectRoot);
    }
  });
});