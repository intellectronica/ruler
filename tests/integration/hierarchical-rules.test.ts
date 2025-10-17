import * as fs from 'fs/promises';
import * as path from 'path';
import { applyAllAgentConfigs } from '../../src/lib';
import * as Constants from '../../src/constants';
import { setupTestProject } from '../harness';

describe('Nested Rules Integration', () => {
  let testProject: { projectRoot: string };

  beforeAll(async () => {
    testProject = await setupTestProject();
  });

  afterAll(async () => {
    // Cleanup the test project
    await fs.rm(testProject.projectRoot, { recursive: true, force: true });
  });

  it('processes each .ruler directory independently in nested mode', async () => {
    // Create nested directory structure
    const moduleDir = path.join(testProject.projectRoot, 'module');
    const submoduleDir = path.join(moduleDir, 'submodule');

    await fs.mkdir(path.join(testProject.projectRoot, '.ruler'), {
      recursive: true,
    });
    await fs.mkdir(path.join(moduleDir, '.ruler'), { recursive: true });
    await fs.mkdir(path.join(submoduleDir, '.ruler'), { recursive: true });

    // Create different rules in each level
    await fs.writeFile(
      path.join(testProject.projectRoot, '.ruler', 'AGENTS.md'),
      '# Root Rules\n\nThese are root-level rules that should only appear in root-level files.',
    );

    await fs.writeFile(
      path.join(testProject.projectRoot, '.ruler', 'ruler.toml'),
      `default_agents = ["root-agent"]
nested = true

[agents]
[agents.claude]
enabled = true
`,
    );

    await fs.writeFile(
      path.join(moduleDir, '.ruler', 'AGENTS.md'),
      '# Module Rules\n\nThese are module-level rules that should only appear in module-level files.',
    );

    await fs.writeFile(
      path.join(moduleDir, '.ruler', 'ruler.toml'),
      `default_agents = ["module-agent"]

[agents]
[agents.copilot]
enabled = false
`,
    );

    await fs.writeFile(
      path.join(submoduleDir, '.ruler', 'AGENTS.md'),
      '# Submodule Rules\n\nThese are submodule-level rules that should only appear in submodule-level files.',
    );

    await fs.writeFile(
      path.join(submoduleDir, '.ruler', 'ruler.toml'),
      `default_agents = ["submodule-agent"]
nested = false

[agents]
[agents.windsurf]
enabled = true
`,
    );

    // Apply with nested flag from project root
    const warnSpy = jest
      .spyOn(Constants, 'logWarn')
      .mockImplementation(() => {});

    const experimentalWarningMessage = 'Nested mode is experimental';

    try {
      await applyAllAgentConfigs(
        testProject.projectRoot, // Start from project root
        ['claude'], // Only test with one agent for simplicity
        undefined, // configPath
        true, // cliMcpEnabled
        undefined, // cliMcpStrategy
        undefined, // cliGitignoreEnabled
        false, // verbose
        false, // dryRun
        false, // localOnly
        true, // nested
      );

      const experimentalWarnings = warnSpy.mock.calls.filter((call) =>
        String(call[0]).includes(experimentalWarningMessage),
      );

      expect(experimentalWarnings).toHaveLength(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          path.join(submoduleDir, '.ruler', 'ruler.toml'),
        ),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('nested = false'),
      );
    } finally {
      warnSpy.mockRestore();
    }

    // Check that each level has its own CLAUDE.md file
    const rootClaudeFile = path.join(testProject.projectRoot, 'CLAUDE.md');
    const moduleClaudeFile = path.join(moduleDir, 'CLAUDE.md');
    const submoduleClaudeFile = path.join(submoduleDir, 'CLAUDE.md');

    // Verify files exist
    expect(
      await fs
        .access(rootClaudeFile)
        .then(() => true)
        .catch(() => false),
    ).toBe(true);
    expect(
      await fs
        .access(moduleClaudeFile)
        .then(() => true)
        .catch(() => false),
    ).toBe(true);
    expect(
      await fs
        .access(submoduleClaudeFile)
        .then(() => true)
        .catch(() => false),
    ).toBe(true);

    // Read file contents
    const rootContent = await fs.readFile(rootClaudeFile, 'utf8');
    const moduleContent = await fs.readFile(moduleClaudeFile, 'utf8');
    const submoduleContent = await fs.readFile(submoduleClaudeFile, 'utf8');

    // Verify each file contains only its level's rules
    expect(rootContent).toContain('Root Rules');
    expect(rootContent).toContain('should only appear in root-level files');
    expect(rootContent).not.toContain('Module Rules');
    expect(rootContent).not.toContain('Submodule Rules');

    expect(moduleContent).toContain('Module Rules');
    expect(moduleContent).toContain('should only appear in module-level files');
    expect(moduleContent).not.toContain('Root Rules');
    expect(moduleContent).not.toContain('Submodule Rules');

    expect(submoduleContent).toContain('Submodule Rules');
    expect(submoduleContent).toContain(
      'should only appear in submodule-level files',
    );
    expect(submoduleContent).not.toContain('Root Rules');
    expect(submoduleContent).not.toContain('Module Rules');
  });

  it('falls back to single-directory behavior when nested=false', async () => {
    // Create nested structure but only put rules in the root
    const moduleDir = path.join(testProject.projectRoot, 'module2');
    await fs.mkdir(path.join(moduleDir, '.ruler'), { recursive: true });

    await fs.writeFile(
      path.join(testProject.projectRoot, '.ruler', 'AGENTS.md'),
      '# Only Global Rules\n\nGlobal rules only.',
    );

    // Apply without nested flag (should use single-directory logic)
    const warnSpy = jest
      .spyOn(Constants, 'logWarn')
      .mockImplementation(() => {});

    try {
      await applyAllAgentConfigs(
        moduleDir,
        ['claude'],
        undefined,
        true,
        undefined,
        undefined,
        false,
        false,
        false,
        false, // nested = false
      );

      const experimentalWarnings = warnSpy.mock.calls.filter((call) =>
        String(call[0]).includes('Nested mode is experimental'),
      );

      expect(experimentalWarnings).toHaveLength(0);
    } finally {
      warnSpy.mockRestore();
    }

    // Should work without errors (testing that single-directory logic still works)
    expect(true).toBe(true); // If we get here, the test passed
  });
});
