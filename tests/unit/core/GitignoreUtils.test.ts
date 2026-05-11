import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';

import { updateGitignore } from '../../../src/core/GitignoreUtils';

describe('GitignoreUtils', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-gitignore-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('updateGitignore', () => {
    it('creates .gitignore with Ruler block when file does not exist', async () => {
      const paths = ['CLAUDE.md', 'AGENTS.md'];
      const gitignorePath = path.join(tmpDir, '.gitignore');

      await updateGitignore(tmpDir, paths);

      const content = await fs.readFile(gitignorePath, 'utf8');
      expect(content).toContain('# START Ruler Generated Files');
      expect(content).toContain('# END Ruler Generated Files');
      expect(content).toContain('/CLAUDE.md');
      expect(content).toContain('/AGENTS.md');
    });

    it('creates .gitignore with empty block when no paths provided', async () => {
      const gitignorePath = path.join(tmpDir, '.gitignore');
      
      await updateGitignore(tmpDir, []);
      
      const content = await fs.readFile(gitignorePath, 'utf8');
      expect(content).toContain('# START Ruler Generated Files');
      expect(content).toContain('# END Ruler Generated Files');
      expect(content.split('\n').length).toBe(4); // header, blank, footer, final newline
    });

    it('updates existing empty .gitignore file', async () => {
      const paths = ['CLAUDE.md'];
      const gitignorePath = path.join(tmpDir, '.gitignore');
      await fs.writeFile(gitignorePath, '');
      
      await updateGitignore(tmpDir, paths);
      
      const content = await fs.readFile(gitignorePath, 'utf8');
      expect(content).toContain('# START Ruler Generated Files');
      expect(content).toContain('/CLAUDE.md');
      expect(content).toContain('# END Ruler Generated Files');
    });

    it('updates existing .gitignore with other content', async () => {
      const paths = ['CLAUDE.md'];
      const gitignorePath = path.join(tmpDir, '.gitignore');
      await fs.writeFile(gitignorePath, 'node_modules/\n*.log\n');
      
      await updateGitignore(tmpDir, paths);
      
      const content = await fs.readFile(gitignorePath, 'utf8');
      expect(content).toContain('node_modules/');
      expect(content).toContain('*.log');
      expect(content).toContain('# START Ruler Generated Files');
      expect(content).toContain('/CLAUDE.md');
      expect(content).toContain('# END Ruler Generated Files');
    });

    it('replaces existing Ruler block with new paths', async () => {
      const paths = ['CLAUDE.md', 'AGENTS.md'];
      const gitignorePath = path.join(tmpDir, '.gitignore');
      const initialContent = `node_modules/
# START Ruler Generated Files
.cursor/rules/ruler_cursor_instructions.mdc
# END Ruler Generated Files
*.log`;
      await fs.writeFile(gitignorePath, initialContent);
      
      await updateGitignore(tmpDir, paths);
      
      const content = await fs.readFile(gitignorePath, 'utf8');
      expect(content).toContain('node_modules/');
      expect(content).toContain('*.log');
      expect(content).toContain('/CLAUDE.md');
      expect(content).toContain('/AGENTS.md');
      expect(content).not.toContain('.cursor/rules/ruler_cursor_instructions.mdc');
    });

    it('sorts paths alphabetically within Ruler block', async () => {
      const paths = ['z-file.md', 'a-file.md', 'b-file.md'];
      const gitignorePath = path.join(tmpDir, '.gitignore');
      
      await updateGitignore(tmpDir, paths);
      
      const content = await fs.readFile(gitignorePath, 'utf8');
      const lines = content.split('\n');
      const startIndex = lines.findIndex(line => line === '# START Ruler Generated Files');
      const endIndex = lines.findIndex(line => line === '# END Ruler Generated Files');
      const rulerLines = lines.slice(startIndex + 1, endIndex).filter(line => line.trim());
      
      expect(rulerLines).toEqual(['/a-file.md', '/b-file.md', '/z-file.md']);
    });

    it('maintains idempotency - no duplicates in Ruler block', async () => {
      const paths = ['CLAUDE.md', 'AGENTS.md'];
      const gitignorePath = path.join(tmpDir, '.gitignore');
      
      // First update
      await updateGitignore(tmpDir, paths);
      // Second update with same paths
      await updateGitignore(tmpDir, paths);
      
      const content = await fs.readFile(gitignorePath, 'utf8');
      const claudeMatches = (content.match(/CLAUDE\.md/g) || []).length;
      const agentsMatches = (content.match(/AGENTS\.md/g) || []).length;
      
      expect(claudeMatches).toBe(1);
      expect(agentsMatches).toBe(1);
    });

    it('adds root-anchored paths even when unanchored versions exist outside Ruler block', async () => {
      const paths = ['CLAUDE.md', 'AGENTS.md'];
      const gitignorePath = path.join(tmpDir, '.gitignore');
      const initialContent = `node_modules/
CLAUDE.md
*.log`;
      await fs.writeFile(gitignorePath, initialContent);
      
      await updateGitignore(tmpDir, paths);
      
      const content = await fs.readFile(gitignorePath, 'utf8');
      const claudeMatches = (content.match(/CLAUDE\.md/g) || []).length;
      
      // Should appear twice: once unanchored (existing) and once anchored (Ruler block)
      expect(claudeMatches).toBe(2);
      expect(content).toContain('CLAUDE.md');     // Unanchored existing
      expect(content).toContain('/CLAUDE.md');    // Anchored in Ruler block
      expect(content).toContain('/AGENTS.md');    // Anchored in Ruler block
    });

    it('converts paths to POSIX format', async () => {
      const paths = ['.aider\\conf.yml'];
      const gitignorePath = path.join(tmpDir, '.gitignore');

      await updateGitignore(tmpDir, paths);

      const content = await fs.readFile(gitignorePath, 'utf8');
      expect(content).toContain('/.aider/conf.yml');
      expect(content).not.toContain('\\');
    });

    it('makes paths relative to project root', async () => {
      const absolutePaths = [
        path.join(tmpDir, 'CLAUDE.md'),
        path.join(tmpDir, 'subdir', 'AGENTS.md')
      ];
      const gitignorePath = path.join(tmpDir, '.gitignore');
      
      await updateGitignore(tmpDir, absolutePaths);
      
      const content = await fs.readFile(gitignorePath, 'utf8');
      expect(content).toContain('/CLAUDE.md');
      expect(content).toContain('/subdir/AGENTS.md');
      expect(content).not.toContain(tmpDir);
    });

    it('handles multiple Ruler blocks by updating the first one', async () => {
      const paths = ['CLAUDE.md'];
      const gitignorePath = path.join(tmpDir, '.gitignore');
      const initialContent = `# START Ruler Generated Files
old-file.md
# END Ruler Generated Files
some-other-content
# START Ruler Generated Files
duplicate-block.md
# END Ruler Generated Files`;
      await fs.writeFile(gitignorePath, initialContent);
      
      await updateGitignore(tmpDir, paths);
      
      const content = await fs.readFile(gitignorePath, 'utf8');
      expect(content).toContain('/CLAUDE.md');
      expect(content).not.toContain('old-file.md');
      // Should still contain the duplicate block
      expect(content).toContain('duplicate-block.md');
    });
  });
});