import * as fs from 'fs/promises';
import * as path from 'path';
import { CursorAgent } from '../../../src/agents/CursorAgent';
import { setupTestProject, teardownTestProject } from '../../harness';

describe('CursorAgent - Rules Directory Copy', () => {
  let testProject: { projectRoot: string };

  beforeEach(async () => {
    testProject = await setupTestProject();
  });

  afterEach(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('copies .claude/rules to .cursor/rules when merge_strategy is cursor', async () => {
    const { projectRoot } = testProject;
    const agent = new CursorAgent();

    // Create .claude directory structure with rules
    const claudeDir = path.join(projectRoot, '.claude');
    const rulesDir = path.join(claudeDir, 'rules');
    await fs.mkdir(rulesDir, { recursive: true });

    // Create some test rule files
    await fs.writeFile(path.join(rulesDir, 'rule1.mdc'), '# Rule 1');
    await fs.writeFile(path.join(rulesDir, 'rule2.mdc'), '# Rule 2');

    // Apply ruler config with cursor merge strategy
    await agent.applyRulerConfig(
      'test rules',
      projectRoot,
      null,
      undefined,
      false,
      undefined,
      claudeDir,
      'cursor',
    );

    // Verify .cursor/rules was created
    const cursorRulesDir = path.join(projectRoot, '.cursor', 'rules');
    const cursorRulesExists = await fs
      .access(cursorRulesDir)
      .then(() => true)
      .catch(() => false);

    expect(cursorRulesExists).toBe(true);

    // Verify rule files were copied
    const rule1Content = await fs.readFile(
      path.join(cursorRulesDir, 'rule1.mdc'),
      'utf8',
    );
    const rule2Content = await fs.readFile(
      path.join(cursorRulesDir, 'rule2.mdc'),
      'utf8',
    );

    expect(rule1Content).toBe('# Rule 1');
    expect(rule2Content).toBe('# Rule 2');
  });

  it('does not copy rules when merge_strategy is not cursor', async () => {
    const { projectRoot } = testProject;
    const agent = new CursorAgent();

    // Create .claude directory structure with rules
    const claudeDir = path.join(projectRoot, '.claude');
    const rulesDir = path.join(claudeDir, 'rules');
    await fs.mkdir(rulesDir, { recursive: true });
    await fs.writeFile(path.join(rulesDir, 'rule1.mdc'), '# Rule 1');

    // Apply ruler config without cursor merge strategy
    await agent.applyRulerConfig(
      'test rules',
      projectRoot,
      null,
      undefined,
      false,
      undefined,
      claudeDir,
      'all',
    );

    // Verify .cursor/rules was NOT created
    const cursorRulesDir = path.join(projectRoot, '.cursor', 'rules');
    const cursorRulesExists = await fs
      .access(cursorRulesDir)
      .then(() => true)
      .catch(() => false);

    expect(cursorRulesExists).toBe(false);
  });

  it('does not copy rules when rulerDir is not .claude', async () => {
    const { projectRoot } = testProject;
    const agent = new CursorAgent();

    // Create .ruler directory structure with rules
    const rulerDir = path.join(projectRoot, '.ruler');
    const rulesDir = path.join(rulerDir, 'rules');
    await fs.mkdir(rulesDir, { recursive: true });
    await fs.writeFile(path.join(rulesDir, 'rule1.mdc'), '# Rule 1');

    // Apply ruler config with cursor merge strategy but .ruler dir
    await agent.applyRulerConfig(
      'test rules',
      projectRoot,
      null,
      undefined,
      false,
      undefined,
      rulerDir,
      'cursor',
    );

    // Verify .cursor/rules was NOT created
    const cursorRulesDir = path.join(projectRoot, '.cursor', 'rules');
    const cursorRulesExists = await fs
      .access(cursorRulesDir)
      .then(() => true)
      .catch(() => false);

    expect(cursorRulesExists).toBe(false);
  });

  it('handles missing rules directory gracefully', async () => {
    const { projectRoot } = testProject;
    const agent = new CursorAgent();

    // Create .claude directory WITHOUT rules subdirectory
    const claudeDir = path.join(projectRoot, '.claude');
    await fs.mkdir(claudeDir, { recursive: true });

    // Should not throw error
    await expect(
      agent.applyRulerConfig(
        'test rules',
        projectRoot,
        null,
        undefined,
        false,
        undefined,
        claudeDir,
        'cursor',
      ),
    ).resolves.not.toThrow();

    // Verify .cursor/rules was NOT created
    const cursorRulesDir = path.join(projectRoot, '.cursor', 'rules');
    const cursorRulesExists = await fs
      .access(cursorRulesDir)
      .then(() => true)
      .catch(() => false);

    expect(cursorRulesExists).toBe(false);
  });
});
