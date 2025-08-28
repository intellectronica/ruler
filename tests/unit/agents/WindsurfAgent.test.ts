import { promises as fs } from 'fs';
import * as path from 'path';
import os from 'os';

import { WindsurfAgent } from '../../../src/agents/WindsurfAgent';

describe('WindsurfAgent', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-windsurf-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const expectedFrontMatter = ['---', 'trigger: always_on', '---', ''].join('\n');

  describe('Basic Agent Interface', () => {
    it('returns correct identifier', () => {
      const agent = new WindsurfAgent();
      expect(agent.getIdentifier()).toBe('windsurf');
    });

    it('returns correct display name', () => {
      const agent = new WindsurfAgent();
      expect(agent.getName()).toBe('Windsurf');
    });

    it('returns correct default output path', () => {
      const agent = new WindsurfAgent();
      const expected = path.join(
        tmpDir,
        '.windsurf',
        'rules',
        'ruler_windsurf_instructions.md',
      );
      expect(agent.getDefaultOutputPath(tmpDir)).toBe(expected);
    });
  });

  describe('File Operations', () => {
    it('prepends trigger frontmatter and writes file', async () => {
      const agent = new WindsurfAgent();
      const rulesDir = path.join(tmpDir, '.windsurf', 'rules');
      const target = path.join(rulesDir, 'ruler_windsurf_instructions.md');

      const sampleRules = 'Sample concatenated rules';

      await agent.applyRulerConfig(sampleRules, tmpDir, null);

      const written = await fs.readFile(target, 'utf8');

      // Check that the file starts with the expected front-matter block
      expect(written.startsWith(expectedFrontMatter)).toBe(true);

      // Check that the original rules content follows the front-matter
      expect(written.endsWith(sampleRules)).toBe(true);
    });

    it('backs up existing file before writing', async () => {
      const agent = new WindsurfAgent();
      const rulesDir = path.join(tmpDir, '.windsurf', 'rules');
      await fs.mkdir(rulesDir, { recursive: true });
      const target = path.join(rulesDir, 'ruler_windsurf_instructions.md');

      // Create an existing file
      await fs.writeFile(target, 'old windsurf rules');

      await agent.applyRulerConfig('new windsurf rules', tmpDir, null);

      // Backup should exist with original content
      const backupContent = await fs.readFile(`${target}.bak`, 'utf8');
      expect(backupContent).toBe('old windsurf rules');
    });
  });

  describe('File Splitting for 12K Character Limit', () => {
    it('does not split files under 12K characters', async () => {
      const agent = new WindsurfAgent();
      const rulesDir = path.join(tmpDir, '.windsurf', 'rules');
      const target = path.join(rulesDir, 'ruler_windsurf_instructions.md');

      // Create content under 12K characters (12,288 bytes)
      const sampleRules = 'A'.repeat(8000); // 8K characters, well under limit

      await agent.applyRulerConfig(sampleRules, tmpDir, null);

      // Should create single file
      const written = await fs.readFile(target, 'utf8');
      expect(written.startsWith(expectedFrontMatter)).toBe(true);
      expect(written.endsWith(sampleRules)).toBe(true);

      // Should not create numbered files
      const target0 = path.join(rulesDir, 'ruler_windsurf_instructions_0.md');
      const target1 = path.join(rulesDir, 'ruler_windsurf_instructions_1.md');
      await expect(fs.access(target0)).rejects.toThrow();
      await expect(fs.access(target1)).rejects.toThrow();
    });

    it('splits files when content exceeds 12K characters', async () => {
      const agent = new WindsurfAgent();
      const rulesDir = path.join(tmpDir, '.windsurf', 'rules');

      // Create content that exceeds 12K characters
      // Each line is about 50 characters, so 300 lines ≈ 15K characters
      const longRule = 'This is a very long rule that contains lots of text.\n';
      const sampleRules = longRule.repeat(300);
      
      // Capture console warnings
      const originalWarn = console.warn;
      const warnings: string[] = [];
      console.warn = (...args: any[]) => {
        warnings.push(args.join(' '));
        return originalWarn.apply(console, args as any);
      };

      try {
        await agent.applyRulerConfig(sampleRules, tmpDir, null);

        // Should issue a warning
        expect(warnings.some(w => w.includes('Windsurf rule content exceeds'))).toBe(true);

        // Should create numbered files
        const target0 = path.join(rulesDir, 'ruler_windsurf_instructions_0.md');
        const target1 = path.join(rulesDir, 'ruler_windsurf_instructions_1.md');
        
        await expect(fs.access(target0)).resolves.toBeUndefined();
        await expect(fs.access(target1)).resolves.toBeUndefined();

        // Each file should have front-matter
        const content0 = await fs.readFile(target0, 'utf8');
        const content1 = await fs.readFile(target1, 'utf8');
        
        expect(content0.startsWith(expectedFrontMatter)).toBe(true);
        expect(content1.startsWith(expectedFrontMatter)).toBe(true);

        // Combined content should match original (minus front-matter duplication)
        const combinedRules = content0.substring(expectedFrontMatter.length) + 
                             content1.substring(expectedFrontMatter.length);
        expect(combinedRules.trim()).toBe(sampleRules.trim());

        // Original single file should not exist
        const originalTarget = path.join(rulesDir, 'ruler_windsurf_instructions.md');
        await expect(fs.access(originalTarget)).rejects.toThrow();

      } finally {
        console.warn = originalWarn;
      }
    });

    it('splits at nearest newline within limit', async () => {
      const agent = new WindsurfAgent();
      const rulesDir = path.join(tmpDir, '.windsurf', 'rules');

      // Create content with specific newline pattern to test splitting behavior
      const frontMatter = ['---', 'trigger: always_on', '---', ''].join('\n');
      const availableSpace = 12288 - frontMatter.length; // 12K - front matter
      
      // Create content that will need splitting at a specific newline
      const shortLine = 'Short line.\n';
      const longPart = 'A'.repeat(availableSpace - 100); // Just under limit
      const nextPart = 'This should be in the next file.\n';
      
      const sampleRules = shortLine.repeat(10) + longPart + '\n' + nextPart + shortLine.repeat(10);

      await agent.applyRulerConfig(sampleRules, tmpDir, null);

      // Should create numbered files
      const target0 = path.join(rulesDir, 'ruler_windsurf_instructions_0.md');
      const target1 = path.join(rulesDir, 'ruler_windsurf_instructions_1.md');
      
      await expect(fs.access(target0)).resolves.toBeUndefined();
      await expect(fs.access(target1)).resolves.toBeUndefined();

      // First file should not exceed the limit
      const content0 = await fs.readFile(target0, 'utf8');
      expect(content0.length).toBeLessThanOrEqual(12288);

      // Should split at a newline (content should end with newline before the split)
      const rules0 = content0.substring(frontMatter.length);
      expect(rules0.endsWith('\n')).toBe(true);
    });

    it('handles content exactly at 12K character limit', async () => {
      const agent = new WindsurfAgent();
      const rulesDir = path.join(tmpDir, '.windsurf', 'rules');
      const target = path.join(rulesDir, 'ruler_windsurf_instructions.md');

      const frontMatter = ['---', 'trigger: always_on', '---', ''].join('\n');
      const exactLimit = 12288 - frontMatter.length;
      const sampleRules = 'A'.repeat(exactLimit);

      await agent.applyRulerConfig(sampleRules, tmpDir, null);

      // Should create single file (exactly at limit, not over)
      const written = await fs.readFile(target, 'utf8');
      expect(written.length).toBe(12288);
      expect(written.startsWith(expectedFrontMatter)).toBe(true);

      // Should not create numbered files
      const target0 = path.join(rulesDir, 'ruler_windsurf_instructions_0.md');
      await expect(fs.access(target0)).rejects.toThrow();
    });

    it('handles empty content without splitting', async () => {
      const agent = new WindsurfAgent();
      const rulesDir = path.join(tmpDir, '.windsurf', 'rules');
      const target = path.join(rulesDir, 'ruler_windsurf_instructions.md');

      await agent.applyRulerConfig('', tmpDir, null);

      // Should create single file with just front-matter
      const written = await fs.readFile(target, 'utf8');
      expect(written).toBe(expectedFrontMatter);

      // Should not create numbered files
      const target0 = path.join(rulesDir, 'ruler_windsurf_instructions_0.md');
      await expect(fs.access(target0)).rejects.toThrow();
    });
  });
});