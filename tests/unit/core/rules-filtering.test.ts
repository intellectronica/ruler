import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { matchesPattern, readMarkdownFiles } from '../../../src/core/FileSystemUtils';
import { loadConfig } from '../../../src/core/ConfigLoader';

describe('Rules Filtering', () => {
  describe('matchesPattern', () => {
    it('should match exact filenames', () => {
      expect(matchesPattern('AGENTS.md', 'AGENTS.md')).toBe(true);
      expect(matchesPattern('AGENTS.md', 'OTHER.md')).toBe(false);
    });

    it('should match single wildcard patterns', () => {
      expect(matchesPattern('file.md', '*.md')).toBe(true);
      expect(matchesPattern('test.md', '*.md')).toBe(true);
      expect(matchesPattern('dir/file.md', '*.md')).toBe(false);
      expect(matchesPattern('file.txt', '*.md')).toBe(false);
    });

    it('should match double wildcard patterns', () => {
      expect(matchesPattern('dir/file.md', '**/*.md')).toBe(true);
      expect(matchesPattern('dir/subdir/file.md', '**/*.md')).toBe(true);
      expect(matchesPattern('file.md', '**/*.md')).toBe(true);
    });

    it('should match directory patterns', () => {
      expect(matchesPattern('.rules/file.md', '.rules/*.md')).toBe(true);
      expect(matchesPattern('.rules/another.md', '.rules/*.md')).toBe(true);
      expect(matchesPattern('other/file.md', '.rules/*.md')).toBe(false);
      expect(matchesPattern('.rules/subdir/file.md', '.rules/*.md')).toBe(false);
    });

    it('should match nested directory patterns', () => {
      expect(matchesPattern('.rules/subdir/file.md', '.rules/**/*.md')).toBe(true);
      expect(matchesPattern('.rules/file.md', '.rules/**/*.md')).toBe(true);
    });
  });

  describe('readMarkdownFiles with filtering', () => {
    let tempDir: string;

    beforeEach(async () => {
      // Create a temporary directory with test files
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-test-'));

      // Create test markdown files
      await fs.writeFile(path.join(tempDir, 'AGENTS.md'), '# Agents');
      await fs.writeFile(path.join(tempDir, 'README.md'), '# README');

      // Create subdirectory with files
      await fs.mkdir(path.join(tempDir, '.rules'));
      await fs.writeFile(path.join(tempDir, '.rules', 'rule1.md'), '# Rule 1');
      await fs.writeFile(path.join(tempDir, '.rules', 'rule2.md'), '# Rule 2');
    });

    afterEach(async () => {
      // Clean up
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should read all files when no filters are specified', async () => {
      const files = await readMarkdownFiles(tempDir);
      expect(files.length).toBe(4);
      const basenames = files.map(f => path.basename(f.path)).sort();
      expect(basenames).toEqual(['AGENTS.md', 'README.md', 'rule1.md', 'rule2.md']);
    });

    it('should exclude files matching exclude patterns', async () => {
      const files = await readMarkdownFiles(tempDir, {
        exclude: ['.rules/*.md'],
      });
      expect(files.length).toBe(2);
      const basenames = files.map(f => path.basename(f.path)).sort();
      expect(basenames).toEqual(['AGENTS.md', 'README.md']);
    });

    it('should include only files matching include patterns', async () => {
      const files = await readMarkdownFiles(tempDir, {
        include: ['AGENTS.md'],
      });
      expect(files.length).toBe(1);
      expect(path.basename(files[0].path)).toBe('AGENTS.md');
    });

    it('should apply exclude after include', async () => {
      const files = await readMarkdownFiles(tempDir, {
        include: ['*.md'],
        exclude: ['README.md'],
      });
      expect(files.length).toBe(1);
      expect(path.basename(files[0].path)).toBe('AGENTS.md');
    });

    it('should handle multiple include patterns', async () => {
      const files = await readMarkdownFiles(tempDir, {
        include: ['AGENTS.md', '.rules/*.md'],
      });
      expect(files.length).toBe(3);
      const basenames = files.map(f => path.basename(f.path)).sort();
      expect(basenames).toEqual(['AGENTS.md', 'rule1.md', 'rule2.md']);
    });

    it('should handle multiple exclude patterns', async () => {
      const files = await readMarkdownFiles(tempDir, {
        exclude: ['README.md', '.rules/*.md'],
      });
      expect(files.length).toBe(1);
      expect(path.basename(files[0].path)).toBe('AGENTS.md');
    });
  });

  describe('Config parsing', () => {
    let tempDir: string;
    let rulerDir: string;
    let configPath: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-test-'));
      rulerDir = path.join(tempDir, '.ruler');
      await fs.mkdir(rulerDir);
      configPath = path.join(rulerDir, 'ruler.toml');
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should parse rules.include from TOML config', async () => {
      const tomlContent = `
[rules]
include = ["AGENTS.md", "*.md"]
`;
      await fs.writeFile(configPath, tomlContent);

      const config = await loadConfig({
        projectRoot: tempDir,
        configPath,
      });

      expect(config.rules).toBeDefined();
      expect(config.rules?.include).toEqual(['AGENTS.md', '*.md']);
    });

    it('should parse rules.exclude from TOML config', async () => {
      const tomlContent = `
[rules]
exclude = [".rules/*.md", "README.md"]
`;
      await fs.writeFile(configPath, tomlContent);

      const config = await loadConfig({
        projectRoot: tempDir,
        configPath,
      });

      expect(config.rules).toBeDefined();
      expect(config.rules?.exclude).toEqual(['.rules/*.md', 'README.md']);
    });

    it('should parse both include and exclude from TOML config', async () => {
      const tomlContent = `
[rules]
include = ["**/*.md"]
exclude = [".rules/*.md"]
`;
      await fs.writeFile(configPath, tomlContent);

      const config = await loadConfig({
        projectRoot: tempDir,
        configPath,
      });

      expect(config.rules).toBeDefined();
      expect(config.rules?.include).toEqual(['**/*.md']);
      expect(config.rules?.exclude).toEqual(['.rules/*.md']);
    });

    it('should handle missing rules section', async () => {
      const tomlContent = `
default_agents = ["claudecode"]
`;
      await fs.writeFile(configPath, tomlContent);

      const config = await loadConfig({
        projectRoot: tempDir,
        configPath,
      });

      expect(config.rules).toBeDefined();
      expect(config.rules?.include).toBeUndefined();
      expect(config.rules?.exclude).toBeUndefined();
    });
  });
});
