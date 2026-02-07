import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import {
  findRulerDir,
  readMarkdownFiles,
} from '../../../src/core/FileSystemUtils';

describe('FileSystemUtils', () => {
  let tmpDir: string;
  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-test-'));
  });
  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('findRulerDir', () => {
    it('finds .ruler in parent directories', async () => {
      const projectDir = path.join(tmpDir, 'project');
      const rulerDir = path.join(projectDir, '.ruler');
      const nestedDir = path.join(projectDir, 'sub', 'child');
      await fs.mkdir(rulerDir, { recursive: true });
      await fs.mkdir(nestedDir, { recursive: true });
      const found = await findRulerDir(nestedDir);
      expect(found).toBe(rulerDir);
    });

    it('returns null if .ruler is not found', async () => {
      const someDir = path.join(tmpDir, 'nofile');
      await fs.mkdir(someDir, { recursive: true });
      const found = await findRulerDir(someDir, false); // Don't check global config
      expect(found).toBeNull();
    });
  });

  describe('readMarkdownFiles', () => {
    it('reads and sorts markdown files', async () => {
      const rulerDir = path.join(tmpDir, '.ruler2');
      const subDir = path.join(rulerDir, 'sub');
      await fs.mkdir(subDir, { recursive: true });
      const fileA = path.join(rulerDir, 'a.md');
      const fileB = path.join(subDir, 'b.md');
      await fs.writeFile(fileA, 'contentA');
      await fs.writeFile(fileB, 'contentB');
      const files = await readMarkdownFiles(rulerDir);
      expect(files.map((f) => f.path)).toEqual([fileA, fileB]);
      expect(files[0].content).toBe('contentA');
      expect(files[1].content).toBe('contentB');
    });

    it('reads symlinked markdown files', async () => {
      const rulerDir = path.join(tmpDir, '.ruler-symlink-file');
      await fs.mkdir(rulerDir, { recursive: true });
      const realFile = path.join(tmpDir, 'external.md');
      await fs.writeFile(realFile, 'symlinked content');
      const linkPath = path.join(rulerDir, 'linked.md');
      await fs.symlink(realFile, linkPath);
      const files = await readMarkdownFiles(rulerDir);
      expect(files.map((f) => f.path)).toContain(linkPath);
      const linked = files.find((f) => f.path === linkPath);
      expect(linked?.content).toBe('symlinked content');
    });

    it('follows symlinked directories', async () => {
      const rulerDir = path.join(tmpDir, '.ruler-symlink-dir');
      await fs.mkdir(rulerDir, { recursive: true });
      const realDir = path.join(tmpDir, 'external-dir');
      await fs.mkdir(realDir, { recursive: true });
      const realFile = path.join(realDir, 'deep.md');
      await fs.writeFile(realFile, 'deep content');
      const linkPath = path.join(rulerDir, 'linked-dir');
      await fs.symlink(realDir, linkPath);
      const files = await readMarkdownFiles(rulerDir);
      const deepFile = path.join(linkPath, 'deep.md');
      expect(files.map((f) => f.path)).toContain(deepFile);
      const deep = files.find((f) => f.path === deepFile);
      expect(deep?.content).toBe('deep content');
    });

    it('skips broken symlinks gracefully', async () => {
      const rulerDir = path.join(tmpDir, '.ruler-broken-symlink');
      await fs.mkdir(rulerDir, { recursive: true });
      const linkPath = path.join(rulerDir, 'broken.md');
      await fs.symlink('/nonexistent/path/file.md', linkPath);
      const files = await readMarkdownFiles(rulerDir);
      expect(files.map((f) => f.path)).not.toContain(linkPath);
    });
  });
});
