import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import yaml from 'js-yaml';

import { CopilotAgent } from '../../../src/agents/CopilotAgent';
import { ClaudeAgent } from '../../../src/agents/ClaudeAgent';
import { CodexCliAgent } from '../../../src/agents/CodexCliAgent';
import { CursorAgent } from '../../../src/agents/CursorAgent';
import { WindsurfAgent } from '../../../src/agents/WindsurfAgent';
import { ClineAgent } from '../../../src/agents/ClineAgent';
import { AiderAgent } from '../../../src/agents/AiderAgent';

describe('Agent Adapters', () => {
  let tmpDir: string;
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-agent-'));
  });
  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('CopilotAgent', () => {
    it('backs up and writes copilot-instructions.md', async () => {
      const agent = new CopilotAgent();
      const githubDir = path.join(tmpDir, '.github');
      await fs.mkdir(githubDir, { recursive: true });
      const target = path.join(githubDir, 'copilot-instructions.md');
      await fs.writeFile(target, 'old copilot');
      await agent.applyRulerConfig('new copilot', tmpDir);
      const backup = await fs.readFile(`${target}.bak`, 'utf8');
      const content = await fs.readFile(target, 'utf8');
      expect(backup).toBe('old copilot');
      expect(content).toBe('new copilot');
    });
  });

  describe('ClaudeAgent', () => {
    it('backs up and writes CLAUDE.md', async () => {
      const agent = new ClaudeAgent();
      const target = path.join(tmpDir, 'CLAUDE.md');
      await fs.writeFile(target, 'old claude');
      await agent.applyRulerConfig('new claude', tmpDir);
      expect(await fs.readFile(`${target}.bak`, 'utf8')).toBe('old claude');
      expect(await fs.readFile(target, 'utf8')).toBe('new claude');
    });
  });

  describe('CodexCliAgent', () => {
    it('backs up and writes AGENTS.md', async () => {
      const agent = new CodexCliAgent();
      const target = path.join(tmpDir, 'AGENTS.md');
      await fs.writeFile(target, 'old codex');
      await agent.applyRulerConfig('new codex', tmpDir);
      expect(await fs.readFile(`${target}.bak`, 'utf8')).toBe('old codex');
      expect(await fs.readFile(target, 'utf8')).toBe('new codex');
    });
  });

  describe('CursorAgent', () => {
    it('backs up and writes ruler_cursor_instructions.md', async () => {
      const agent = new CursorAgent();
      const rulesDir = path.join(tmpDir, '.cursor', 'rules');
      await fs.mkdir(rulesDir, { recursive: true });
      const target = path.join(rulesDir, 'ruler_cursor_instructions.md');
      await fs.writeFile(target, 'old cursor');
      await agent.applyRulerConfig('new cursor', tmpDir);
      expect(await fs.readFile(`${target}.bak`, 'utf8')).toBe('old cursor');
      expect(await fs.readFile(target, 'utf8')).toBe('new cursor');
    });
  });

  describe('WindsurfAgent', () => {
    it('backs up and writes ruler_windsurf_instructions.md', async () => {
      const agent = new WindsurfAgent();
      const rulesDir = path.join(tmpDir, '.windsurf', 'rules');
      await fs.mkdir(rulesDir, { recursive: true });
      const target = path.join(rulesDir, 'ruler_windsurf_instructions.md');
      await fs.writeFile(target, 'old windsurf');
      await agent.applyRulerConfig('new windsurf', tmpDir);
      expect(await fs.readFile(`${target}.bak`, 'utf8')).toBe('old windsurf');
      expect(await fs.readFile(target, 'utf8')).toBe('new windsurf');
    });
  });

  describe('ClineAgent', () => {
    it('backs up and writes .clinerules', async () => {
      const agent = new ClineAgent();
      const target = path.join(tmpDir, '.clinerules');
      await fs.writeFile(target, 'old cline');
      await agent.applyRulerConfig('new cline', tmpDir);
      expect(await fs.readFile(`${target}.bak`, 'utf8')).toBe('old cline');
      expect(await fs.readFile(target, 'utf8')).toBe('new cline');
    });
  });

  describe('AiderAgent', () => {
    it('creates and updates .aider.conf.yml', async () => {
      const agent = new AiderAgent();
      // No existing config
      await agent.applyRulerConfig('aider rules', tmpDir);
      const mdFile = path.join(tmpDir, 'ruler_aider_instructions.md');
      expect(await fs.readFile(mdFile, 'utf8')).toBe('aider rules');
      const cfg = yaml.load(await fs.readFile(path.join(tmpDir, '.aider.conf.yml'), 'utf8')) as any;
      expect(cfg.read).toContain('ruler_aider_instructions.md');

      // Existing config with read not array
      const cfgPath = path.join(tmpDir, '.aider.conf.yml');
      await fs.writeFile(cfgPath, 'read: outdated');
      await agent.applyRulerConfig('new aider', tmpDir);
      const updated = yaml.load(await fs.readFile(cfgPath, 'utf8')) as any;
      expect(Array.isArray(updated.read)).toBe(true);
      expect(updated.read).toContain('ruler_aider_instructions.md');
    });
  });
});