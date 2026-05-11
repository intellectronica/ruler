import * as fs from 'fs/promises';
import * as path from 'path';
import { setupTestProject, teardownTestProject, runRuler } from '../harness';

describe('Test Harness', () => {
  describe('setupTestProject', () => {
    let testProject: { projectRoot: string };

    afterEach(async () => {
      if (testProject) {
        await teardownTestProject(testProject.projectRoot);
      }
    });

    it('creates a unique temporary directory', async () => {
      testProject = await setupTestProject();
      
      expect(testProject.projectRoot).toBeDefined();
      expect(testProject.projectRoot).toContain('ruler-test-');
      
      // Verify directory exists
      const stats = await fs.stat(testProject.projectRoot);
      expect(stats.isDirectory()).toBe(true);
    });

    it('creates multiple unique directories', async () => {
      const project1 = await setupTestProject();
      const project2 = await setupTestProject();
      
      expect(project1.projectRoot).not.toBe(project2.projectRoot);
      
      // Clean up
      await teardownTestProject(project1.projectRoot);
      await teardownTestProject(project2.projectRoot);
    });

    it('creates files when provided', async () => {
      const files = {
        '.ruler/AGENTS.md': '# Test Instructions',
        '.ruler/ruler.toml': 'default_agents = ["GitHub Copilot"]',
        'README.md': '# Test Project'
      };
      
      testProject = await setupTestProject(files);
      
      // Verify all files were created with correct content
      for (const [relativePath, expectedContent] of Object.entries(files)) {
        const fullPath = path.join(testProject.projectRoot, relativePath);
        const actualContent = await fs.readFile(fullPath, 'utf8');
        expect(actualContent).toBe(expectedContent);
      }
    });

    it('creates nested directory structures', async () => {
      const files = {
        'deep/nested/path/file.txt': 'nested content',
        '.ruler/subdir/config.json': '{"test": true}'
      };
      
      testProject = await setupTestProject(files);
      
      // Verify nested files exist
      const nestedFile = path.join(testProject.projectRoot, 'deep/nested/path/file.txt');
      const configFile = path.join(testProject.projectRoot, '.ruler/subdir/config.json');
      
      expect(await fs.readFile(nestedFile, 'utf8')).toBe('nested content');
      expect(await fs.readFile(configFile, 'utf8')).toBe('{"test": true}');
    });

    it('works with empty files object', async () => {
      testProject = await setupTestProject({});
      
      expect(testProject.projectRoot).toBeDefined();
      const stats = await fs.stat(testProject.projectRoot);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('teardownTestProject', () => {
    it('removes the project directory and all contents', async () => {
      const testProject = await setupTestProject({
        'file1.txt': 'content1',
        'subdir/file2.txt': 'content2'
      });
      
      // Verify directory exists
      await expect(fs.stat(testProject.projectRoot)).resolves.toBeDefined();
      
      // Teardown
      await teardownTestProject(testProject.projectRoot);
      
      // Verify directory no longer exists
      await expect(fs.stat(testProject.projectRoot)).rejects.toThrow();
    });

    it('handles non-existent directories gracefully', async () => {
      const nonExistentPath = '/tmp/does-not-exist-' + Date.now();
      
      // Should not throw
      await expect(teardownTestProject(nonExistentPath)).resolves.toBeUndefined();
    });
  });

  describe('runRuler', () => {
    let testProject: { projectRoot: string };

    beforeEach(async () => {
      // Create a basic test project with ruler configuration
      testProject = await setupTestProject({
        '.ruler/AGENTS.md': '# Test Rule',
        '.ruler/ruler.toml': 'default_agents = ["GitHub Copilot"]'
      });
    });

    afterEach(async () => {
      if (testProject) {
        await teardownTestProject(testProject.projectRoot);
      }
    });

    it('executes ruler commands and returns output', async () => {
      const output = runRuler('apply', testProject.projectRoot);
      
      expect(output).toBeDefined();
      expect(typeof output).toBe('string');
    });

    it('works with command arguments', async () => {
      const output = runRuler('apply --agents copilot', testProject.projectRoot);
      
      expect(output).toBeDefined();
      expect(typeof output).toBe('string');
    });

    it('throws on invalid commands', () => {
      expect(() => {
        runRuler('invalid-command', testProject.projectRoot);
      }).toThrow();
    });
  });
});