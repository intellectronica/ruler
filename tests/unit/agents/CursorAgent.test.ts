import { promises as fs } from 'fs';
import * as path from 'path';
import os from 'os';

import { CursorAgent } from '../../../src/agents/CursorAgent';

describe('CursorAgent', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-cursor-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const expectedFrontMatter = ['---', 'alwaysApply: true', '---', ''].join('\n');

  describe('Basic Agent Interface', () => {
    it('returns correct identifier', () => {
      const agent = new CursorAgent();
      expect(agent.getIdentifier()).toBe('cursor');
    });

    it('returns correct display name', () => {
      const agent = new CursorAgent();
      expect(agent.getName()).toBe('Cursor');
    });

    it('returns correct default output path', () => {
      const agent = new CursorAgent();
      const expected = path.join(
        tmpDir,
        '.cursor',
        'rules',
        'ruler_cursor_instructions.mdc',
      );
      expect(agent.getDefaultOutputPath(tmpDir)).toBe(expected);
    });
  });

  describe('File Operations', () => {
    it('prepends alwaysApply front-matter and writes file', async () => {
      const agent = new CursorAgent();
      const rulesDir = path.join(tmpDir, '.cursor', 'rules');
      const target = path.join(rulesDir, 'ruler_cursor_instructions.mdc');

      const sampleRules = 'Sample concatenated rules';

      await agent.applyRulerConfig(sampleRules, tmpDir, null);

      const written = await fs.readFile(target, 'utf8');

      // Check that the file starts with the expected front-matter block
      expect(written.startsWith(expectedFrontMatter)).toBe(true);

      // Check that the original rules content follows the front-matter
      expect(written.endsWith(sampleRules)).toBe(true);
    });

    it('backs up existing file before writing', async () => {
      const agent = new CursorAgent();
      const rulesDir = path.join(tmpDir, '.cursor', 'rules');
      await fs.mkdir(rulesDir, { recursive: true });
      const target = path.join(rulesDir, 'ruler_cursor_instructions.mdc');

      // Create an existing file
      await fs.writeFile(target, 'old cursor rules');

      await agent.applyRulerConfig('new cursor rules', tmpDir, null);

      // Backup should exist with original content
      const backupContent = await fs.readFile(`${target}.bak`, 'utf8');
      expect(backupContent).toBe('old cursor rules');
    });
  });
});

