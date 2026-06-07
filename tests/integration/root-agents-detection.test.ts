import * as fs from 'fs/promises';
import * as path from 'path';
import { execFileSync } from 'child_process';
import {
  setupTestProject,
  teardownTestProject,
  runRulerWithInheritedStdio,
} from '../harness';

/**
 * Integration test for Task 4: Auto-detect repository root AGENTS.md
 */
describe('Root AGENTS.md detection', () => {
  let projectRoot: string;

  beforeAll(async () => {
    const proj = await setupTestProject({
      '.ruler/AGENTS.md': 'Inner rules file',
      '.ruler/extra.md': 'Extra inner file',
    });
    projectRoot = proj.projectRoot;
  });

  afterAll(async () => {
    await teardownTestProject(projectRoot);
  });

  afterEach(async () => {
    // Clean generated outputs between tests
    await fs.rm(path.join(projectRoot, 'AGENTS.md'), { force: true });
    await fs.rm(path.join(projectRoot, 'AGENTS.md.bak'), { force: true });
    await fs.rm(path.join(projectRoot, '.github'), {
      recursive: true,
      force: true,
    });
    await fs.rm(path.join(projectRoot, 'subdir'), {
      recursive: true,
      force: true,
    });
    await fs.rm(path.join(projectRoot, 'CLAUDE.md'), { force: true });
  });

  it('concatenates root AGENTS.md before .ruler markdown files when both exist', async () => {
    // Create a root AGENTS.md (outside .ruler) with distinct content
    const rootAgentsPath = path.join(projectRoot, 'AGENTS.md');
    await fs.writeFile(rootAgentsPath, 'Root priority content', 'utf8');

    // Run apply to generate agent outputs (use a single agent for simplicity)
    runRulerWithInheritedStdio('apply --agents codex', projectRoot);

    const codexOutput = await fs.readFile(
      path.join(projectRoot, 'AGENTS.md'),
      'utf8',
    );
    // Expect root content appears before inner content by checking order of markers
    const rootIndex = codexOutput.indexOf('Root priority content');
    const innerIndex = codexOutput.indexOf('Inner rules file');
    expect(rootIndex).toBeGreaterThanOrEqual(0);
    expect(innerIndex).toBeGreaterThan(rootIndex);

    // Verify source annotations reflect correct relative paths
    expect(codexOutput).toMatch(/<!-- Source: AGENTS.md -->/);
    expect(codexOutput).toMatch(/<!-- Source: \.ruler\/AGENTS.md -->/);
  });

  it('uses only .ruler files when root AGENTS.md missing', async () => {
    // Ensure root AGENTS.md absent
    await fs.rm(path.join(projectRoot, 'AGENTS.md'), { force: true });

    runRulerWithInheritedStdio('apply --agents codex', projectRoot);
    const codexOutput = await fs.readFile(
      path.join(projectRoot, 'AGENTS.md'),
      'utf8',
    );
    expect(codexOutput).toContain('Inner rules file');
    expect(codexOutput).toContain('Extra inner file');
    // Should NOT include a Source section for root AGENTS.md
    expect(codexOutput).not.toMatch(/<!-- Source: AGENTS.md -->$/m);
  });

  it('writes generated files at the discovered project root when apply runs from a subdirectory', async () => {
    const subdir = path.join(projectRoot, 'subdir');
    await fs.mkdir(subdir);

    execFileSync(
      'node',
      [
        path.resolve('dist/cli/index.js'),
        'apply',
        '--agents',
        'agentsmd',
        '--no-backup',
        '--no-gitignore',
      ],
      {
        cwd: subdir,
        stdio: 'pipe',
      },
    );

    await expect(
      fs.readFile(path.join(projectRoot, 'AGENTS.md'), 'utf8'),
    ).resolves.toContain('Inner rules file');
    await expect(fs.stat(path.join(subdir, 'AGENTS.md'))).rejects.toThrow();
  });

  it('reverts generated files at the discovered project root when revert runs from a subdirectory', async () => {
    const subdir = path.join(projectRoot, 'subdir');
    await fs.mkdir(subdir);

    runRulerWithInheritedStdio(
      'apply --agents agentsmd --no-backup --no-gitignore',
      projectRoot,
    );

    execFileSync(
      'node',
      [path.resolve('dist/cli/index.js'), 'revert', '--agents', 'agentsmd'],
      {
        cwd: subdir,
        stdio: 'pipe',
      },
    );

    await expect(
      fs.stat(path.join(projectRoot, 'AGENTS.md')),
    ).rejects.toThrow();
    await expect(fs.stat(path.join(subdir, 'AGENTS.md'))).rejects.toThrow();
  });
});
