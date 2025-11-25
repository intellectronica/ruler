import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { readMarkdownFiles } from '../../../src/core/FileSystemUtils';

describe('Cursor Mode', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skiller-cursor-test-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('merge_strategy: cursor', () => {
    it('should include AGENTS.md and rules/*.mdc files with alwaysApply: true', async () => {
      // Create AGENTS.md
      await fs.writeFile(
        path.join(testDir, 'AGENTS.md'),
        '# Main Agent Instructions\n\nGeneral guidelines for all agents.',
      );

      // Create rules directory with .mdc files
      const rulesDir = path.join(testDir, 'rules');
      await fs.mkdir(rulesDir, { recursive: true });

      // Create .mdc file with alwaysApply: true
      await fs.writeFile(
        path.join(rulesDir, 'always-applied.mdc'),
        `---
description: This rule should always be applied
alwaysApply: true
---
# Always Applied Rule

This content should be included.`,
      );

      // Create .mdc file with alwaysApply: false
      await fs.writeFile(
        path.join(rulesDir, 'not-applied.mdc'),
        `---
description: This rule should not be applied
alwaysApply: false
---
# Not Applied Rule

This content should be excluded.`,
      );

      // Create .mdc file without frontmatter
      await fs.writeFile(
        path.join(rulesDir, 'no-frontmatter.mdc'),
        `# No Frontmatter Rule

This content should be excluded (no alwaysApply).`,
      );

      const files = await readMarkdownFiles(testDir, {
        merge_strategy: 'cursor',
      });

      // Should include AGENTS.md and only always-applied.mdc
      expect(files.length).toBe(2);
      expect(files.some((f) => f.path.endsWith('AGENTS.md'))).toBe(true);
      expect(files.some((f) => f.path.endsWith('always-applied.mdc'))).toBe(true);
      expect(files.some((f) => f.path.endsWith('not-applied.mdc'))).toBe(false);
      expect(files.some((f) => f.path.endsWith('no-frontmatter.mdc'))).toBe(false);
    });

    it('should strip frontmatter from included .mdc files', async () => {
      await fs.writeFile(
        path.join(testDir, 'AGENTS.md'),
        '# Main Instructions',
      );

      const rulesDir = path.join(testDir, 'rules');
      await fs.mkdir(rulesDir, { recursive: true });

      await fs.writeFile(
        path.join(rulesDir, 'test.mdc'),
        `---
description: Test rule
alwaysApply: true
globs:
  - "**/*.ts"
---
# Test Rule Body

This is the actual content.`,
      );

      const files = await readMarkdownFiles(testDir, {
        merge_strategy: 'cursor',
      });

      const mdcFile = files.find((f) => f.path.endsWith('test.mdc'));
      expect(mdcFile).toBeDefined();
      // Content should not contain frontmatter
      expect(mdcFile!.content).not.toContain('description: Test rule');
      expect(mdcFile!.content).not.toContain('alwaysApply: true');
      expect(mdcFile!.content).not.toContain('---');
      // Content should contain the body
      expect(mdcFile!.content).toContain('# Test Rule Body');
      expect(mdcFile!.content).toContain('This is the actual content.');
    });

    it('should not strip frontmatter from AGENTS.md', async () => {
      await fs.writeFile(
        path.join(testDir, 'AGENTS.md'),
        `---
custom: metadata
---
# Main Instructions

With frontmatter.`,
      );

      const files = await readMarkdownFiles(testDir, {
        merge_strategy: 'cursor',
      });

      const agentsFile = files.find((f) => f.path.endsWith('AGENTS.md'));
      expect(agentsFile).toBeDefined();
      // AGENTS.md should keep its full content (including frontmatter if present)
      expect(agentsFile!.content).toContain('---');
      expect(agentsFile!.content).toContain('custom: metadata');
    });

    it('should only process .mdc files in rules/ directory', async () => {
      await fs.writeFile(
        path.join(testDir, 'AGENTS.md'),
        '# Main Instructions',
      );

      const rulesDir = path.join(testDir, 'rules');
      await fs.mkdir(rulesDir, { recursive: true });

      const otherDir = path.join(testDir, 'other');
      await fs.mkdir(otherDir, { recursive: true });

      // Create .mdc file in rules/ with alwaysApply: true
      await fs.writeFile(
        path.join(rulesDir, 'in-rules.mdc'),
        `---
alwaysApply: true
---
Content in rules/`,
      );

      // Create .mdc file in other/ with alwaysApply: true
      await fs.writeFile(
        path.join(otherDir, 'not-in-rules.mdc'),
        `---
alwaysApply: true
---
Content not in rules/`,
      );

      const files = await readMarkdownFiles(testDir, {
        merge_strategy: 'cursor',
      });

      // Should only include AGENTS.md and the file in rules/
      expect(files.length).toBe(2);
      expect(files.some((f) => f.path.includes('in-rules.mdc'))).toBe(true);
      expect(files.some((f) => f.path.includes('not-in-rules.mdc'))).toBe(false);
    });

    it('should work with nested subdirectories in rules/', async () => {
      await fs.writeFile(
        path.join(testDir, 'AGENTS.md'),
        '# Main Instructions',
      );

      const rulesDir = path.join(testDir, 'rules');
      const nestedDir = path.join(rulesDir, 'coding');
      await fs.mkdir(nestedDir, { recursive: true });

      await fs.writeFile(
        path.join(nestedDir, 'nested.mdc'),
        `---
alwaysApply: true
---
Nested rule content`,
      );

      const files = await readMarkdownFiles(testDir, {
        merge_strategy: 'cursor',
      });

      expect(files.length).toBe(2);
      expect(files.some((f) => f.path.includes('nested.mdc'))).toBe(true);
    });

    it('should handle empty rules/ directory', async () => {
      await fs.writeFile(
        path.join(testDir, 'AGENTS.md'),
        '# Main Instructions',
      );

      const rulesDir = path.join(testDir, 'rules');
      await fs.mkdir(rulesDir, { recursive: true });

      const files = await readMarkdownFiles(testDir, {
        merge_strategy: 'cursor',
      });

      // Should only include AGENTS.md
      expect(files.length).toBe(1);
      expect(files[0].path.endsWith('AGENTS.md')).toBe(true);
    });

    it('should handle missing AGENTS.md', async () => {
      const rulesDir = path.join(testDir, 'rules');
      await fs.mkdir(rulesDir, { recursive: true });

      await fs.writeFile(
        path.join(rulesDir, 'test.mdc'),
        `---
alwaysApply: true
---
Rule content`,
      );

      const files = await readMarkdownFiles(testDir, {
        merge_strategy: 'cursor',
      });

      // Should only include the .mdc file with alwaysApply
      expect(files.length).toBe(1);
      expect(files[0].path.endsWith('test.mdc')).toBe(true);
    });

    it('should ignore .md files in rules/ directory', async () => {
      await fs.writeFile(
        path.join(testDir, 'AGENTS.md'),
        '# Main Instructions',
      );

      const rulesDir = path.join(testDir, 'rules');
      await fs.mkdir(rulesDir, { recursive: true });

      // Create .md file in rules/
      await fs.writeFile(
        path.join(rulesDir, 'ignored.md'),
        '# This .md file should be ignored in cursor mode',
      );

      // Create .mdc file with alwaysApply
      await fs.writeFile(
        path.join(rulesDir, 'included.mdc'),
        `---
alwaysApply: true
---
This .mdc file should be included`,
      );

      const files = await readMarkdownFiles(testDir, {
        merge_strategy: 'cursor',
      });

      // Should include AGENTS.md and only the .mdc file
      expect(files.length).toBe(2);
      expect(files.some((f) => f.path.endsWith('AGENTS.md'))).toBe(true);
      expect(files.some((f) => f.path.endsWith('included.mdc'))).toBe(true);
      expect(files.some((f) => f.path.endsWith('ignored.md'))).toBe(false);
    });

    it('should maintain alphabetical order (AGENTS.md first, then sorted rules)', async () => {
      await fs.writeFile(
        path.join(testDir, 'AGENTS.md'),
        '# Main Instructions',
      );

      const rulesDir = path.join(testDir, 'rules');
      await fs.mkdir(rulesDir, { recursive: true });

      // Create multiple .mdc files with alwaysApply (in non-alphabetical creation order)
      await fs.writeFile(
        path.join(rulesDir, 'zebra.mdc'),
        `---
alwaysApply: true
---
Zebra content`,
      );

      await fs.writeFile(
        path.join(rulesDir, 'alpha.mdc'),
        `---
alwaysApply: true
---
Alpha content`,
      );

      await fs.writeFile(
        path.join(rulesDir, 'middle.mdc'),
        `---
alwaysApply: true
---
Middle content`,
      );

      const files = await readMarkdownFiles(testDir, {
        merge_strategy: 'cursor',
      });

      // Should have 4 files in correct order
      expect(files.length).toBe(4);

      // First should be AGENTS.md
      expect(files[0].path.endsWith('AGENTS.md')).toBe(true);

      // Remaining should be alphabetically sorted by filename
      expect(files[1].path.endsWith('alpha.mdc')).toBe(true);
      expect(files[2].path.endsWith('middle.mdc')).toBe(true);
      expect(files[3].path.endsWith('zebra.mdc')).toBe(true);
    });
  });

  describe('merge_strategy: all (default)', () => {
    it('should include all markdown files regardless of frontmatter', async () => {
      await fs.writeFile(
        path.join(testDir, 'AGENTS.md'),
        '# Main Instructions',
      );

      const rulesDir = path.join(testDir, 'rules');
      await fs.mkdir(rulesDir, { recursive: true });

      await fs.writeFile(
        path.join(rulesDir, 'with-frontmatter.mdc'),
        `---
alwaysApply: false
---
Content with frontmatter`,
      );

      await fs.writeFile(
        path.join(rulesDir, 'without-frontmatter.md'),
        'Content without frontmatter',
      );

      // Default behavior (no merge_strategy specified, or merge_strategy: 'all')
      const files = await readMarkdownFiles(testDir);

      // Should include all files
      expect(files.length).toBe(3);
      expect(files.some((f) => f.path.endsWith('AGENTS.md'))).toBe(true);
      expect(files.some((f) => f.path.endsWith('with-frontmatter.mdc'))).toBe(true);
      expect(files.some((f) => f.path.endsWith('without-frontmatter.md'))).toBe(true);
    });

    it('should not strip frontmatter in default mode', async () => {
      const rulesDir = path.join(testDir, 'rules');
      await fs.mkdir(rulesDir, { recursive: true });

      await fs.writeFile(
        path.join(rulesDir, 'test.mdc'),
        `---
description: Test
alwaysApply: true
---
Body content`,
      );

      const files = await readMarkdownFiles(testDir, {
        merge_strategy: 'all',
      });

      const mdcFile = files.find((f) => f.path.endsWith('test.mdc'));
      expect(mdcFile).toBeDefined();
      // Content should contain frontmatter in default mode
      expect(mdcFile!.content).toContain('---');
      expect(mdcFile!.content).toContain('description: Test');
      expect(mdcFile!.content).toContain('alwaysApply: true');
      expect(mdcFile!.content).toContain('Body content');
    });
  });
});
