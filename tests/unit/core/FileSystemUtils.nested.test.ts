import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { findAllRulerDirs } from '../../../src/core/FileSystemUtils';

describe('FileSystemUtils - Nested', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-nested-test-'));
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('findAllRulerDirs', () => {
    it('finds all .ruler directories in hierarchy', async () => {
      // Create nested directory structure
      const projectDir = path.join(tmpDir, 'project');
      const moduleDir = path.join(projectDir, 'module');
      const submoduleDir = path.join(moduleDir, 'submodule');

      await fs.mkdir(path.join(projectDir, '.ruler'), { recursive: true });
      await fs.mkdir(path.join(moduleDir, '.ruler'), { recursive: true });
      await fs.mkdir(path.join(submoduleDir, '.ruler'), { recursive: true });

      const rulerDirs = await findAllRulerDirs(projectDir);

      // Should find all three .ruler directories, most specific first
      expect(rulerDirs).toHaveLength(3);
      expect(rulerDirs[0]).toBe(path.join(submoduleDir, '.ruler'));
      expect(rulerDirs[1]).toBe(path.join(moduleDir, '.ruler'));
      expect(rulerDirs[2]).toBe(path.join(projectDir, '.ruler'));
    });

    it('returns empty array when no .ruler directories found', async () => {
      const someDir = path.join(tmpDir, 'empty');
      await fs.mkdir(someDir, { recursive: true });

      const rulerDirs = await findAllRulerDirs(someDir);
      expect(rulerDirs).toHaveLength(0);
    });
  });
});
