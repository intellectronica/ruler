import { promises as fs } from 'fs';
import * as path from 'path';
import os from 'os';

import { KiloCodeAgent } from '../../../src/agents/KiloCodeAgent';

describe('KiloCodeAgent', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-kilocode-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('Basic Agent Interface', () => {
    it('returns correct identifier', () => {
      const agent = new KiloCodeAgent();
      expect(agent.getIdentifier()).toBe('kilocode');
    });

    it('returns correct display name', () => {
      const agent = new KiloCodeAgent();
      expect(agent.getName()).toBe('Kilo Code');
    });

    it('returns correct default output path', () => {
      const agent = new KiloCodeAgent();
      const expected = path.join(
        tmpDir,
        '.kilocode',
        'rules',
        'ruler_kilocode_instructions.md',
      );
      expect(agent.getDefaultOutputPath(tmpDir)).toBe(expected);
    });
  });

  describe('File Operations', () => {
    it('backs up and writes ruler_kilocode_instructions.md', async () => {
      const agent = new KiloCodeAgent();
      const rulesDir = path.join(tmpDir, '.kilocode', 'rules');
      await fs.mkdir(rulesDir, { recursive: true });
      const target = path.join(rulesDir, 'ruler_kilocode_instructions.md');

      // Create existing file
      await fs.writeFile(target, 'old kilocode rules');

      // Apply new configuration
      await agent.applyRulerConfig('new kilocode rules', tmpDir, null);

      // Verify backup was created
      expect(await fs.readFile(`${target}.bak`, 'utf8')).toBe(
        'old kilocode rules',
      );

      // Verify new content was written
      expect(await fs.readFile(target, 'utf8')).toBe('new kilocode rules');
    });

    it('creates directory structure if it does not exist', async () => {
      const agent = new KiloCodeAgent();
      const target = path.join(
        tmpDir,
        '.kilocode',
        'rules',
        'ruler_kilocode_instructions.md',
      );

      // Apply configuration without creating directory first
      await agent.applyRulerConfig('kilocode content', tmpDir, null);

      // Verify file was created with correct content
      expect(await fs.readFile(target, 'utf8')).toBe('kilocode content');
    });

    it('uses custom outputPath when provided', async () => {
      const agent = new KiloCodeAgent();
      const custom = path.join(tmpDir, 'custom_kilocode.md');
      await fs.mkdir(path.dirname(custom), { recursive: true });

      await agent.applyRulerConfig('custom kilocode data', tmpDir, null, {
        outputPath: custom,
      });

      expect(await fs.readFile(custom, 'utf8')).toBe('custom kilocode data');
    });
  });

  describe('Configuration Overrides', () => {
    it('respects custom output path in agent config', async () => {
      const agent = new KiloCodeAgent();
      const customPath = path.join(tmpDir, 'custom', 'kilocode_rules.md');

      await agent.applyRulerConfig('custom path content', tmpDir, null, {
        outputPath: customPath,
      });

      expect(await fs.readFile(customPath, 'utf8')).toBe('custom path content');
    });

    it('returns correct MCP server key', () => {
      const agent = new KiloCodeAgent();
      expect(agent.getMcpServerKey()).toBe('mcpServers');
    });
  });
});
