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
});