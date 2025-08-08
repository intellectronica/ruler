import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { execSync } from 'child_process';

describe('apply-disable-backup.toml', () => {
  let tmpDir: string;
  let rulerDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-backup-'));
    rulerDir = path.join(tmpDir, '.ruler');
    await fs.mkdir(rulerDir, { recursive: true });
    
    // Create a simple instruction file
    await fs.writeFile(
      path.join(rulerDir, 'instructions.md'),
      '# Test Instructions\n\nThis is a test.',
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('does not create backup files when disable_backup=true in TOML', async () => {
    const toml = `disable_backup = true
default_agents = ["Claude"]
`;
    await fs.writeFile(path.join(rulerDir, 'ruler.toml'), toml);
    
    execSync('npm run build', { stdio: 'inherit' });
    execSync(`node dist/cli/index.js apply --project-root ${tmpDir}`, {
      stdio: 'inherit',
    });
    
    // Check that no backup files were created
    const claudeFile = path.join(tmpDir, 'CLAUDE.md');
    const backupFile = path.join(tmpDir, 'CLAUDE.md.bak');
    
    expect(await fs.access(claudeFile).then(() => true).catch(() => false)).toBe(true);
    expect(await fs.access(backupFile).then(() => true).catch(() => false)).toBe(false);
  });

  it('creates backup files when disable_backup=false in TOML', async () => {
    const toml = `disable_backup = false
default_agents = ["Claude"]
`;
    await fs.writeFile(path.join(rulerDir, 'ruler.toml'), toml);
    
    // Create a pre-existing file to back up
    const claudeFile = path.join(tmpDir, 'CLAUDE.md');
    await fs.writeFile(claudeFile, '# Existing content\n');
    
    execSync('npm run build', { stdio: 'inherit' });
    execSync(`node dist/cli/index.js apply --project-root ${tmpDir}`, {
      stdio: 'inherit',
    });
    
    // Check that backup file was created
    const backupFile = path.join(tmpDir, 'CLAUDE.md.bak');
    
    expect(await fs.access(claudeFile).then(() => true).catch(() => false)).toBe(true);
    expect(await fs.access(backupFile).then(() => true).catch(() => false)).toBe(true);
    
    const backupContent = await fs.readFile(backupFile, 'utf8');
    expect(backupContent).toBe('# Existing content\n');
  });

  it('CLI --disable-backup overrides TOML disable_backup=false', async () => {
    const toml = `disable_backup = false
default_agents = ["Claude"]
`;
    await fs.writeFile(path.join(rulerDir, 'ruler.toml'), toml);
    
    // Create a pre-existing file to back up
    const claudeFile = path.join(tmpDir, 'CLAUDE.md');
    await fs.writeFile(claudeFile, '# Existing content\n');
    
    execSync('npm run build', { stdio: 'inherit' });
    execSync(`node dist/cli/index.js apply --disable-backup --project-root ${tmpDir}`, {
      stdio: 'inherit',
    });
    
    // Check that no backup file was created despite TOML setting
    const backupFile = path.join(tmpDir, 'CLAUDE.md.bak');
    
    expect(await fs.access(claudeFile).then(() => true).catch(() => false)).toBe(true);
    expect(await fs.access(backupFile).then(() => true).catch(() => false)).toBe(false);
  });
});