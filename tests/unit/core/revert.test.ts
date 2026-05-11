import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { revertAllAgentConfigs } from '../../../src/revert';

describe('Revert Core Functions', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-revert-unit-'));
    
    const rulerDir = path.join(tmpDir, '.ruler');
    await fs.mkdir(rulerDir, { recursive: true });
    await fs.writeFile(path.join(rulerDir, 'instructions.md'), 'Test Rule');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('revertAllAgentConfigs', () => {
    it('should throw error when .ruler directory not found', async () => {
      const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-empty-'));
      
      try {
        await expect(
          revertAllAgentConfigs(emptyDir, undefined, undefined, false, false, false, true),
        ).rejects.toThrow('.ruler directory not found');
      } finally {
        await fs.rm(emptyDir, { recursive: true, force: true });
      }
    });

    it('should handle dry-run mode correctly', async () => {
      await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), 'Generated content');
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await revertAllAgentConfigs(tmpDir, undefined, undefined, false, false, true);
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[ruler:dry-run] Revert summary (dry run):'));
      
      await expect(fs.access(path.join(tmpDir, 'CLAUDE.md'))).resolves.toBeUndefined();
      
      consoleSpy.mockRestore();
    });

    it('should handle verbose logging', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await revertAllAgentConfigs(tmpDir, undefined, undefined, false, true, false);
      
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle specific agents filter', async () => {
      await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), 'Claude content');
      await fs.writeFile(path.join(tmpDir, 'AGENTS.md'), 'Agents content');
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await revertAllAgentConfigs(tmpDir, ['claude'], undefined, false, false, false);
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Reverting Claude Code'));
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Reverting OpenAI Codex CLI'));
      
      consoleSpy.mockRestore();
    });

    it('should handle keep-backups flag', async () => {
      const filePath = path.join(tmpDir, 'CLAUDE.md');
      const backupPath = `${filePath}.bak`;
      
      await fs.writeFile(backupPath, 'Original content');
      await fs.writeFile(filePath, 'Modified content');
      
      await revertAllAgentConfigs(tmpDir, undefined, undefined, true, false, false);
      
      await expect(fs.access(backupPath)).resolves.toBeUndefined();
      
      const restoredContent = await fs.readFile(filePath, 'utf8');
      expect(restoredContent).toBe('Original content');
    });

    it('should remove backup files when keep-backups is false', async () => {
      const filePath = path.join(tmpDir, 'CLAUDE.md');
      const backupPath = `${filePath}.bak`;
      
      await fs.writeFile(backupPath, 'Original content');
      await fs.writeFile(filePath, 'Modified content');
      
      await revertAllAgentConfigs(tmpDir, undefined, undefined, false, false, false);
      
      await expect(fs.access(backupPath)).rejects.toThrow();
      
      const restoredContent = await fs.readFile(filePath, 'utf8');
      expect(restoredContent).toBe('Original content');
    });

    it('should remove generated files without backups', async () => {
      const filePath = path.join(tmpDir, 'CLAUDE.md');
      await fs.writeFile(filePath, 'Generated content');
      
      await revertAllAgentConfigs(tmpDir, undefined, undefined, false, false, false);
      
      await expect(fs.access(filePath)).rejects.toThrow();
    });

    it('should clean up empty directories', async () => {
      const githubDir = path.join(tmpDir, '.github');
      const cursorDir = path.join(tmpDir, '.cursor');
      
      await fs.mkdir(githubDir, { recursive: true });
      await fs.mkdir(cursorDir, { recursive: true });
      
      await revertAllAgentConfigs(tmpDir, undefined, undefined, false, false, false);
      
      await expect(fs.access(githubDir)).rejects.toThrow();
      await expect(fs.access(cursorDir)).rejects.toThrow();
    });

    it('should preserve non-empty directories', async () => {
      const githubDir = path.join(tmpDir, '.github');
      await fs.mkdir(githubDir, { recursive: true });
      await fs.writeFile(path.join(githubDir, 'existing-file.txt'), 'Existing content');
      
      await revertAllAgentConfigs(tmpDir, undefined, undefined, false, false, false);
      
      await expect(fs.access(githubDir)).resolves.toBeUndefined();
      await expect(fs.access(path.join(githubDir, 'existing-file.txt'))).resolves.toBeUndefined();
    });
  });

  describe('dry-run logging patterns', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should use [ruler:dry-run] prefix consistently when dryRun is true', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), 'Generated content');
      
      await revertAllAgentConfigs(tmpDir, undefined, undefined, false, false, true); // dryRun=true
      
      const logCalls = consoleLogSpy.mock.calls.flat();
      const hasRulerDryRunPrefix = logCalls.some(call => 
        typeof call === 'string' && call.includes('[ruler:dry-run]')
      );
      
      expect(hasRulerDryRunPrefix).toBe(true);
      consoleLogSpy.mockRestore();
    });

    it('should use [ruler] prefix consistently when dryRun is false', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), 'Generated content');
      
      await revertAllAgentConfigs(tmpDir, undefined, undefined, false, false, false); // dryRun=false
      
      const logCalls = consoleLogSpy.mock.calls.flat();
      const hasRulerPrefix = logCalls.some(call => 
        typeof call === 'string' && call.includes('[ruler]') && !call.includes('[ruler:dry-run]')
      );
      
      expect(hasRulerPrefix).toBe(true);
      consoleLogSpy.mockRestore();
    });
  });
});
