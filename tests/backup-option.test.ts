import * as fs from 'fs/promises';
import * as path from 'path';
import { setupTestProject, teardownTestProject, runRuler } from './harness';

describe('backup option', () => {
  let testProject: { projectRoot: string };

  beforeEach(async () => {
    testProject = await setupTestProject({
      '.ruler/AGENTS.md': '# Test Rules\n\nSome test rules here.',
      '.ruler/ruler.toml': '# Test config\ndefault_agents = ["copilot"]\n',
      '.github/copilot-instructions.md': '# Existing file\nThis should be backed up.',
    });
  });

  afterEach(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('creates .bak files by default', async () => {
    const { projectRoot } = testProject;
    const targetFile = path.join(projectRoot, '.github', 'copilot-instructions.md');
    const backupFile = path.join(projectRoot, '.github', 'copilot-instructions.md.bak');
    
    runRuler('apply', projectRoot);
    
    // Check that backup file was created
    const backupExists = await fs.access(backupFile).then(() => true).catch(() => false);
    expect(backupExists).toBe(true);
    
    // Check backup file content matches original
    const backupContent = await fs.readFile(backupFile, 'utf8');
    expect(backupContent).toBe('# Existing file\nThis should be backed up.');
  });

  it('creates .bak files with --backup flag', async () => {
    const { projectRoot } = testProject;
    const targetFile = path.join(projectRoot, '.github', 'copilot-instructions.md');
    const backupFile = path.join(projectRoot, '.github', 'copilot-instructions.md.bak');
    
    runRuler('apply --backup', projectRoot);
    
    // Check that backup file was created
    const backupExists = await fs.access(backupFile).then(() => true).catch(() => false);
    expect(backupExists).toBe(true);
    
    // Check backup file content matches original
    const backupContent = await fs.readFile(backupFile, 'utf8');
    expect(backupContent).toBe('# Existing file\nThis should be backed up.');
  });

  it('does not create .bak files with --no-backup flag', async () => {
    const { projectRoot } = testProject;
    const targetFile = path.join(projectRoot, '.github', 'copilot-instructions.md');
    const backupFile = path.join(projectRoot, '.github', 'copilot-instructions.md.bak');
    
    runRuler('apply --no-backup', projectRoot);
    
    // Check that backup file was NOT created
    const backupExists = await fs.access(backupFile).then(() => true).catch(() => false);
    expect(backupExists).toBe(false);
    
    // Check that the target file was still updated
    const targetContent = await fs.readFile(targetFile, 'utf8');
    expect(targetContent).toContain('# Test Rules');
    expect(targetContent).toContain('Some test rules here.');
  });

  it('does not add .bak paths to .gitignore with --no-backup', async () => {
    const { projectRoot } = testProject;
    const gitignoreFile = path.join(projectRoot, '.gitignore');
    
    runRuler('apply --no-backup', projectRoot);
    
    // Check .gitignore content
    const gitignoreContent = await fs.readFile(gitignoreFile, 'utf8');
    
    // Should not contain *.bak pattern
    expect(gitignoreContent).not.toContain('*.bak');
    
    // Should still contain the main generated file path
    expect(gitignoreContent).toContain('.github/copilot-instructions.md');
  });

  it('adds .bak paths to .gitignore with --backup (default)', async () => {
    const { projectRoot } = testProject;
    const gitignoreFile = path.join(projectRoot, '.gitignore');
    
    runRuler('apply --backup', projectRoot);
    
    // Check .gitignore content
    const gitignoreContent = await fs.readFile(gitignoreFile, 'utf8');
    
    // Should contain *.bak pattern
    expect(gitignoreContent).toContain('*.bak');
    
    // Should also contain specific backup paths
    expect(gitignoreContent).toContain('.github/copilot-instructions.md.bak');
  });
});