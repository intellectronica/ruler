import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { execSync } from 'child_process';

describe('End-to-End ruler init command', () => {
  let tmpDir: string;
  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-init-e2e-'));
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates .ruler directory and default files', async () => {
    // Build and run init
    
    execSync(`node dist/cli/index.js init --project-root ${tmpDir}`, {
      stdio: 'inherit',
    });

    const rulerDir = path.join(tmpDir, '.ruler');
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
    const rulerDir = path.join(tmpDir, '.ruler');
    const instr = path.join(rulerDir, 'instructions.md');
    const toml = path.join(rulerDir, 'ruler.toml');
    // Prepopulate with markers
    await fs.writeFile(instr, 'KEEP');
    await fs.writeFile(toml, 'KEEP');
    execSync(`node dist/cli/index.js init --project-root ${tmpDir}`, { stdio: 'inherit' });
    expect(await fs.readFile(instr, 'utf8')).toBe('KEEP');
    expect(await fs.readFile(toml, 'utf8')).toBe('KEEP');
  });
});