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
    const instr = path.join(rulerDir, 'instructions.md');
    const toml = path.join(rulerDir, 'ruler.toml');
    await expect(fs.stat(rulerDir)).resolves.toBeDefined();
    await expect(
      fs.readFile(instr, 'utf8'),
    ).resolves.toMatch(/^# Ruler Instructions/);
    await expect(
      fs.readFile(toml, 'utf8'),
    ).resolves.toMatch(/^# Ruler Configuration File/);
  });

  it('does not overwrite existing files', async () => {
    const { projectRoot } = testProject;
    const rulerDir = path.join(projectRoot, '.ruler');
    const instr = path.join(rulerDir, 'instructions.md');
    const toml = path.join(rulerDir, 'ruler.toml');
    // Prepopulate with markers
    await fs.writeFile(instr, 'KEEP');
    await fs.writeFile(toml, 'KEEP');
    runRulerWithInheritedStdio('init', projectRoot);
    expect(await fs.readFile(instr, 'utf8')).toBe('KEEP');
    expect(await fs.readFile(toml, 'utf8')).toBe('KEEP');
  });
});