import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Revert Helper Functions', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-helpers-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('fileExists functionality', () => {
    it('should detect existing files', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      await fs.writeFile(filePath, 'content');
      
      const { revertAllAgentConfigs } = await import('../../../src/revert');
      
      await fs.mkdir(path.join(tmpDir, '.ruler'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, '.ruler', 'test.md'), 'rule');
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await revertAllAgentConfigs(tmpDir, ['claude'], undefined, false, false, true);
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Files processed: 2'));
      
      consoleSpy.mockRestore();
    });
  });

  describe('restoreFromBackup functionality', () => {
    it('should restore files from backup', async () => {
      const filePath = path.join(tmpDir, 'CLAUDE.md');
      const backupPath = `${filePath}.bak`;
      
      await fs.writeFile(backupPath, 'Original content');
      await fs.writeFile(filePath, 'Modified content');
      
      await fs.mkdir(path.join(tmpDir, '.ruler'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, '.ruler', 'test.md'), 'rule');
      
      const { revertAllAgentConfigs } = await import('../../../src/revert');
      await revertAllAgentConfigs(tmpDir, ['claude'], undefined, false, false, false);
      
      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe('Original content');
    });

    it('should handle missing backup gracefully', async () => {
      const filePath = path.join(tmpDir, 'CLAUDE.md');
      await fs.writeFile(filePath, 'Generated content');
      
      await fs.mkdir(path.join(tmpDir, '.ruler'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, '.ruler', 'test.md'), 'rule');
      
      const { revertAllAgentConfigs } = await import('../../../src/revert');
      
      await revertAllAgentConfigs(tmpDir, ['claude'], undefined, false, false, false);
      
      await expect(fs.access(filePath)).rejects.toThrow();
    });
  });

  describe('removeGeneratedFile functionality', () => {
    it('should remove files without backups', async () => {
      const filePath = path.join(tmpDir, 'CLAUDE.md');
      await fs.writeFile(filePath, 'Generated content');
      
      await fs.mkdir(path.join(tmpDir, '.ruler'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, '.ruler', 'test.md'), 'rule');
      
      const { revertAllAgentConfigs } = await import('../../../src/revert');
      await revertAllAgentConfigs(tmpDir, ['claude'], undefined, false, false, false);
      
      await expect(fs.access(filePath)).rejects.toThrow();
    });

    it('should skip files with backups', async () => {
      const filePath = path.join(tmpDir, 'CLAUDE.md');
      const backupPath = `${filePath}.bak`;
      
      await fs.writeFile(filePath, 'Modified content');
      await fs.writeFile(backupPath, 'Original content');
      
      await fs.mkdir(path.join(tmpDir, '.ruler'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, '.ruler', 'test.md'), 'rule');
      
      const { revertAllAgentConfigs } = await import('../../../src/revert');
      await revertAllAgentConfigs(tmpDir, ['claude'], undefined, false, false, false);
      
      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe('Original content');
    });
  });

  describe('cleanGitignore functionality', () => {
    it('should remove ruler block from .gitignore', async () => {
      const gitignorePath = path.join(tmpDir, '.gitignore');
      const content = `node_modules/
*.log

# START Ruler Generated Files
CLAUDE.md
AGENTS.md
# END Ruler Generated Files

dist/`;
      
      await fs.writeFile(gitignorePath, content);
      
      await fs.mkdir(path.join(tmpDir, '.ruler'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, '.ruler', 'test.md'), 'rule');
      
      const { revertAllAgentConfigs } = await import('../../../src/revert');
      await revertAllAgentConfigs(tmpDir, undefined, undefined, false, false, false);
      
      const cleanedContent = await fs.readFile(gitignorePath, 'utf8');
      expect(cleanedContent).not.toContain('# START Ruler Generated Files');
      expect(cleanedContent).not.toContain('CLAUDE.md');
      expect(cleanedContent).toContain('node_modules/');
      expect(cleanedContent).toContain('dist/');
    });

    it('should remove empty .gitignore file', async () => {
      const gitignorePath = path.join(tmpDir, '.gitignore');
      const content = `# START Ruler Generated Files
CLAUDE.md
# END Ruler Generated Files`;
      
      await fs.writeFile(gitignorePath, content);
      
      await fs.mkdir(path.join(tmpDir, '.ruler'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, '.ruler', 'test.md'), 'rule');
      
      const { revertAllAgentConfigs } = await import('../../../src/revert');
      await revertAllAgentConfigs(tmpDir, undefined, undefined, false, false, false);
      
      await expect(fs.access(gitignorePath)).rejects.toThrow();
    });

    it('should handle missing .gitignore gracefully', async () => {
      await fs.mkdir(path.join(tmpDir, '.ruler'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, '.ruler', 'test.md'), 'rule');
      
      const { revertAllAgentConfigs } = await import('../../../src/revert');
      
      await expect(revertAllAgentConfigs(tmpDir, undefined, undefined, false, false, false))
        .resolves.toBeUndefined();
    });
  });

  describe('removeAdditionalAgentFiles functionality', () => {
    it('should remove additional agent files', async () => {
      await fs.mkdir(path.join(tmpDir, '.gemini'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, '.gemini', 'settings.json'), '{}');
      await fs.writeFile(path.join(tmpDir, '.mcp.json'), '{}');
      
      await fs.mkdir(path.join(tmpDir, '.ruler'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, '.ruler', 'test.md'), 'rule');
      
      const { revertAllAgentConfigs } = await import('../../../src/revert');
      await revertAllAgentConfigs(tmpDir, undefined, undefined, false, false, false);
      
      await expect(fs.access(path.join(tmpDir, '.gemini', 'settings.json'))).rejects.toThrow();
      await expect(fs.access(path.join(tmpDir, '.mcp.json'))).rejects.toThrow();
    });
  });
});
