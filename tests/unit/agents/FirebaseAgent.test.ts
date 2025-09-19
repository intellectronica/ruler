import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { FirebaseAgent } from '../../../src/agents/FirebaseAgent';

describe('FirebaseAgent', () => {
  let tmpDir: string;
  let agent: FirebaseAgent;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'firebase-agent-'));
    agent = new FirebaseAgent();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('agent properties', () => {
    it('returns correct identifier', () => {
      expect(agent.getIdentifier()).toBe('firebase');
    });

    it('returns correct name', () => {
      expect(agent.getName()).toBe('Firebase Studio');
    });

    it('returns correct default output path', () => {
      const expected = path.join(tmpDir, '.idx', 'airules.md');
      expect(agent.getDefaultOutputPath(tmpDir)).toBe(expected);
    });

    it('supports MCP stdio servers', () => {
      expect(agent.supportsMcpStdio()).toBe(true);
    });

    it('does not support MCP remote servers (for now)', () => {
      expect(agent.supportsMcpRemote()).toBe(false);
    });
  });

  describe('applyRulerConfig', () => {
    it('creates .idx directory and writes airules.md', async () => {
      const rules = 'Test rules for Firebase Studio';
      await agent.applyRulerConfig(rules, tmpDir, null);

      const outputPath = path.join(tmpDir, '.idx', 'airules.md');
      const content = await fs.readFile(outputPath, 'utf8');
      expect(content).toBe(rules);
    });

    it('backs up existing airules.md file', async () => {
      // Create existing file
      const idxDir = path.join(tmpDir, '.idx');
      await fs.mkdir(idxDir, { recursive: true });
      const outputPath = path.join(idxDir, 'airules.md');
      const existingContent = 'Existing Firebase rules';
      await fs.writeFile(outputPath, existingContent);

      // Apply new rules
      const newRules = 'New Firebase rules';
      await agent.applyRulerConfig(newRules, tmpDir, null);

      // Check backup was created
      const backupPath = `${outputPath}.bak`;
      const backupContent = await fs.readFile(backupPath, 'utf8');
      expect(backupContent).toBe(existingContent);

      // Check new content was written
      const content = await fs.readFile(outputPath, 'utf8');
      expect(content).toBe(newRules);
    });

    it('uses custom output path when provided', async () => {
      const rules = 'some rules';
      const customPath = path.join(tmpDir, 'custom', 'firebase-rules.md');
      await fs.mkdir(path.dirname(customPath), { recursive: true });
      await agent.applyRulerConfig(rules, tmpDir, null, { outputPath: customPath });
      const content = await fs.readFile(customPath, 'utf8');
      expect(content).toBe(rules);
    });
  });
});