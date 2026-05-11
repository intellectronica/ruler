import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

describe('Revert CLI Integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-cli-integration-'));
    
    const rulerDir = path.join(tmpDir, '.ruler');
    await fs.mkdir(rulerDir, { recursive: true });
    await fs.writeFile(path.join(rulerDir, 'instructions.md'), 'Test Rule');
    
    
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('CLI Command Structure', () => {
    it('should show help for revert command', () => {
      const output = execSync(`node dist/cli/index.js revert --help`, { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      expect(output).toContain('Revert ruler configurations');
      expect(output).toContain('--project-root');
      expect(output).toContain('--agents');
      expect(output).toContain('--config');
      expect(output).toContain('--keep-backups');
      expect(output).toContain('--verbose');
      expect(output).toContain('--dry-run');
      expect(output).toContain('--local-only');
    });

    it('should handle missing .ruler directory with proper error', () => {
      const emptyDir = path.join(os.tmpdir(), 'empty-' + Date.now());
      
      expect(() => {
        execSync(
          `node dist/cli/index.js revert --project-root ${emptyDir} --local-only`,
          { stdio: 'pipe' },
        );
      }).toThrow();
    });
  });

  describe('CLI Options', () => {
    it('should handle --project-root option', () => {
      const testFile = path.join(tmpDir, 'CLAUDE.md');
      fsSync.writeFileSync(testFile, 'test content');

      const output = execSync(`node dist/cli/index.js revert --project-root ${tmpDir} --dry-run`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      expect(output).toContain('[ruler:dry-run]');
      expect(output).toContain('Revert summary (dry run)');
    });

    it('should handle --agents option', () => {
      fsSync.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), 'claude content');
      fsSync.writeFileSync(path.join(tmpDir, 'AGENTS.md'), 'agents content');

      const output = execSync(`node dist/cli/index.js revert --project-root ${tmpDir} --agents claude --dry-run`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      expect(output).toContain('Reverting Claude Code');
      expect(output).not.toContain('Reverting OpenAI Codex CLI');
    });

    it('should handle --keep-backups option', async () => {
      const filePath = path.join(tmpDir, 'CLAUDE.md');
      const backupPath = `${filePath}.bak`;
      
      await fs.writeFile(backupPath, 'original');
      await fs.writeFile(filePath, 'modified');
      
      execSync(`node dist/cli/index.js revert --project-root ${tmpDir} --keep-backups`, {
        stdio: 'inherit'
      });
      
      await expect(fs.access(backupPath)).resolves.toBeUndefined();
    });

    it('should handle --verbose option', () => {
      const output = execSync(`node dist/cli/index.js revert --project-root ${tmpDir} --verbose --dry-run`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      expect(output.length).toBeGreaterThan(100);
      expect(output).toContain('[ruler:dry-run]');
    });

    it('should handle --dry-run option', async () => {
      const testFile = path.join(tmpDir, 'CLAUDE.md');
      await fs.writeFile(testFile, 'test content');
      
      const output = execSync(`node dist/cli/index.js revert --project-root ${tmpDir} --dry-run`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      expect(output).toContain('[ruler:dry-run]');
      expect(output).toContain('Revert summary (dry run)');
      
      await expect(fs.access(testFile)).resolves.toBeUndefined();
    });

    it('should handle --local-only option', () => {
      const output = execSync(`node dist/cli/index.js revert --project-root ${tmpDir} --local-only --dry-run`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      expect(output).toContain('[ruler:dry-run]');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid project root', () => {
      expect(() => {
        execSync(
          `node dist/cli/index.js revert --project-root /nonexistent/path --local-only`,
          { stdio: 'pipe' },
        );
      }).toThrow();
    });

    it('should handle invalid agents list gracefully', () => {
      const output = execSync(`node dist/cli/index.js revert --project-root ${tmpDir} --agents invalid-agent --dry-run`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      expect(output).toContain('[ruler:dry-run]');
    });
  });

  describe('Output Format', () => {
    it('should provide structured output for dry-run', () => {
      const output = execSync(`node dist/cli/index.js revert --project-root ${tmpDir} --dry-run`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      expect(output).toContain('Revert summary (dry run):');
      expect(output).toContain('Files processed:');
      expect(output).toContain('Files restored from backup:');
      expect(output).toContain('Generated files removed:');
    });

    it('should provide structured output for actual revert', () => {
      const output = execSync(`node dist/cli/index.js revert --project-root ${tmpDir}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      expect(output).toContain('Revert completed successfully');
      expect(output).toContain('Files processed:');
      expect(output).toContain('Files restored from backup:');
      expect(output).toContain('Generated files removed:');
    });
  });

  describe('Integration with Apply', () => {
    it('should revert everything that apply creates', async () => {
      execSync(`node dist/cli/index.js apply --project-root ${tmpDir}`, { stdio: 'inherit' });
      
      await expect(fs.access(path.join(tmpDir, 'CLAUDE.md'))).resolves.toBeUndefined();
      await expect(fs.access(path.join(tmpDir, 'AGENTS.md'))).resolves.toBeUndefined();
      
      execSync(`node dist/cli/index.js revert --project-root ${tmpDir}`, { stdio: 'inherit' });
      
      await expect(fs.access(path.join(tmpDir, 'CLAUDE.md'))).rejects.toThrow();
      await expect(fs.access(path.join(tmpDir, 'AGENTS.md'))).rejects.toThrow();
    });
  });
});
