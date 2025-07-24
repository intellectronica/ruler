import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { findRulerDir, readMarkdownFiles } from '../../../src/core/FileSystemUtils';

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
  });
});