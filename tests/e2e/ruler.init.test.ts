import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { setupTestProject, teardownTestProject, runRulerWithInheritedStdio } from '../harness';

describe('End-to-End ruler init command', () => {
  let testProject: { projectRoot: string };
  
  beforeAll(async () => {
    testProject = await setupTestProject();
  });

  afterAll(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('creates .ruler directory and default files', async () => {
    const { projectRoot } = testProject;
    
    runRulerWithInheritedStdio('init', projectRoot);

    const rulerDir = path.join(projectRoot, '.ruler');
  const instr = path.join(rulerDir, 'AGENTS.md');
    const toml = path.join(rulerDir, 'ruler.toml');
    await expect(fs.stat(rulerDir)).resolves.toBeDefined();
    await expect(
      fs.readFile(instr, 'utf8'),
    ).resolves.toMatch(/^# AGENTS\.md/);
    await expect(
      fs.readFile(toml, 'utf8'),
    ).resolves.toMatch(/^# Ruler Configuration File/);
  });

  it('does not overwrite existing files', async () => {
    const { projectRoot } = testProject;
    const rulerDir = path.join(projectRoot, '.ruler');
  const instr = path.join(rulerDir, 'AGENTS.md');
    const toml = path.join(rulerDir, 'ruler.toml');
    // Prepopulate with markers
    await fs.writeFile(instr, 'KEEP');
    await fs.writeFile(toml, 'KEEP');
    runRulerWithInheritedStdio('init', projectRoot);
    expect(await fs.readFile(instr, 'utf8')).toBe('KEEP');
    expect(await fs.readFile(toml, 'utf8')).toBe('KEEP');
  });

  it('creates AGENTS.md alongside legacy instructions.md if legacy exists', async () => {
    // create isolated new project root to not interfere with earlier tests
    const { projectRoot } = await setupTestProject();
    const rulerDir = path.join(projectRoot, '.ruler');
    await fs.mkdir(rulerDir, { recursive: true });
    const legacyPath = path.join(rulerDir, 'instructions.md');
    await fs.writeFile(legacyPath, 'LEGACY');
    runRulerWithInheritedStdio('init', projectRoot);
    const newPath = path.join(rulerDir, 'AGENTS.md');
    await expect(fs.readFile(legacyPath, 'utf8')).resolves.toBe('LEGACY');
  await expect(fs.readFile(newPath, 'utf8')).resolves.toMatch(/^# AGENTS\.md/);
    await teardownTestProject(projectRoot);
  });
});