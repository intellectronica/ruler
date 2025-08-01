import { promises as fs } from 'fs';
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
import { FirebaseAgent } from '../../../src/agents/FirebaseAgent';
import { JunieAgent } from '../../../src/agents/JunieAgent';
import { AugmentCodeAgent } from '../../../src/agents/AugmentCodeAgent';

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
      await agent.applyRulerConfig('new copilot', tmpDir, null);
      const backup = await fs.readFile(`${target}.bak`, 'utf8');
      const content = await fs.readFile(target, 'utf8');
      expect(backup).toBe('old copilot');
      expect(content).toBe('new copilot');
    });
  });
  it('uses custom outputPath when provided', async () => {
    const agent = new CopilotAgent();
    const custom = path.join(tmpDir, 'custom_copilot.md');
    await fs.mkdir(path.dirname(custom), { recursive: true });
    await agent.applyRulerConfig('custom data', tmpDir, null, { outputPath: custom });
    expect(await fs.readFile(custom, 'utf8')).toBe('custom data');
  });

  describe('ClaudeAgent', () => {
  it('backs up and writes CLAUDE.md', async () => {
      const agent = new ClaudeAgent();
      const target = path.join(tmpDir, 'CLAUDE.md');
      await fs.writeFile(target, 'old claude');
      await agent.applyRulerConfig('new claude', tmpDir, null);
      expect(await fs.readFile(`${target}.bak`, 'utf8')).toBe('old claude');
      expect(await fs.readFile(target, 'utf8')).toBe('new claude');
    });
  });
  it('uses custom outputPath when provided', async () => {
    const agent = new ClaudeAgent();
    const custom = path.join(tmpDir, 'CUSTOM_CLAUDE.md');
    await fs.mkdir(path.dirname(custom), { recursive: true });
    await agent.applyRulerConfig('x', tmpDir, null, { outputPath: custom });
    expect(await fs.readFile(custom, 'utf8')).toBe('x');
  });

  describe('CodexCliAgent', () => {
  it('backs up and writes AGENTS.md', async () => {
      const agent = new CodexCliAgent();
      const target = path.join(tmpDir, 'AGENTS.md');
      await fs.writeFile(target, 'old codex');
      await agent.applyRulerConfig('new codex', tmpDir, null);
      expect(await fs.readFile(`${target}.bak`, 'utf8')).toBe('old codex');
      expect(await fs.readFile(target, 'utf8')).toBe('new codex');
    });
  });
  it('uses custom outputPath when provided', async () => {
    const agent = new CodexCliAgent();
    const custom = path.join(tmpDir, 'CUSTOM_AGENTS.md');
    await fs.mkdir(path.dirname(custom), { recursive: true });
    await agent.applyRulerConfig('y', tmpDir, null, { outputPath: custom });
    expect(await fs.readFile(custom, 'utf8')).toBe('y');
  });

  describe('CursorAgent', () => {
  it('backs up and writes ruler_cursor_instructions.mdc', async () => {
      const agent = new CursorAgent();
      const rulesDir = path.join(tmpDir, '.cursor', 'rules');
      await fs.mkdir(rulesDir, { recursive: true });
      const target = path.join(rulesDir, 'ruler_cursor_instructions.mdc');
      await fs.writeFile(target, 'old cursor');
      await agent.applyRulerConfig('new cursor', tmpDir, null);
      expect(await fs.readFile(`${target}.bak`, 'utf8')).toBe('old cursor');
      const content = await fs.readFile(target, 'utf8');
      expect(content).toContain('new cursor');
      });
  });
  it('uses custom outputPath when provided', async () => {
    const agent = new CursorAgent();
    const customDir = path.join(tmpDir, '.cursor', 'rules');
    await fs.mkdir(customDir, { recursive: true });
    const custom = path.join(tmpDir, 'custom_cursor.mdc');
    await fs.mkdir(path.dirname(custom), { recursive: true });
    await agent.applyRulerConfig('z', tmpDir, null, { outputPath: custom });
    const content = await fs.readFile(custom, 'utf8');
    expect(content).toContain('z');
  });

  describe('WindsurfAgent', () => {
  it('backs up and writes ruler_windsurf_instructions.md', async () => {
      const agent = new WindsurfAgent();
      const rulesDir = path.join(tmpDir, '.windsurf', 'rules');
      await fs.mkdir(rulesDir, { recursive: true });
      const target = path.join(rulesDir, 'ruler_windsurf_instructions.md');
      await fs.writeFile(target, 'old windsurf');
      await agent.applyRulerConfig('new windsurf', tmpDir, null);
      expect(await fs.readFile(`${target}.bak`, 'utf8')).toBe('old windsurf');
      expect(await fs.readFile(target, 'utf8')).toBe('new windsurf');
    });
  });
  it('uses custom outputPath when provided', async () => {
    const agent = new WindsurfAgent();
    const customDir = path.join(tmpDir, '.windsurf', 'rules');
    await fs.mkdir(customDir, { recursive: true });
    const custom = path.join(tmpDir, 'custom_windsurf.md');
    await fs.mkdir(path.dirname(custom), { recursive: true });
    await agent.applyRulerConfig('w', tmpDir, null, { outputPath: custom });
    expect(await fs.readFile(custom, 'utf8')).toBe('w');
  });

  describe('ClineAgent', () => {
  it('backs up and writes .clinerules', async () => {
      const agent = new ClineAgent();
      const target = path.join(tmpDir, '.clinerules');
      await fs.writeFile(target, 'old cline');
      await agent.applyRulerConfig('new cline', tmpDir, null);
      expect(await fs.readFile(`${target}.bak`, 'utf8')).toBe('old cline');
      expect(await fs.readFile(target, 'utf8')).toBe('new cline');
    });
  });
  it('uses custom outputPath when provided', async () => {
    const agent = new ClineAgent();
    const custom = path.join(tmpDir, 'custom_cline');
    await fs.mkdir(path.dirname(custom), { recursive: true });
    await agent.applyRulerConfig('c', tmpDir, null, { outputPath: custom });
    expect(await fs.readFile(custom, 'utf8')).toBe('c');
  });

  describe('AiderAgent', () => {
  it('creates and updates .aider.conf.yml', async () => {
      const agent = new AiderAgent();
      // No existing config
      await agent.applyRulerConfig('aider rules', tmpDir, null);
      const mdFile = path.join(tmpDir, 'ruler_aider_instructions.md');
      expect(await fs.readFile(mdFile, 'utf8')).toBe('aider rules');
      const cfg = yaml.load(await fs.readFile(path.join(tmpDir, '.aider.conf.yml'), 'utf8')) as any;
      expect(cfg.read).toContain('ruler_aider_instructions.md');

      // Existing config with read not array
      const cfgPath = path.join(tmpDir, '.aider.conf.yml');
      await fs.writeFile(cfgPath, 'read: outdated');
      await agent.applyRulerConfig('new aider', tmpDir, null);
      const updated = yaml.load(await fs.readFile(cfgPath, 'utf8')) as any;
      expect(Array.isArray(updated.read)).toBe(true);
      expect(updated.read).toContain('ruler_aider_instructions.md');
    });
  });
  it('uses custom outputPathInstructions when provided', async () => {
    const agent = new AiderAgent();
    const customMd = path.join(tmpDir, 'custom_aider.md');
    await fs.mkdir(path.dirname(customMd), { recursive: true });
    await agent.applyRulerConfig('aider data', tmpDir, null, { outputPathInstructions: customMd });
    expect(await fs.readFile(customMd, 'utf8')).toBe('aider data');
    const cfg = yaml.load(
      await fs.readFile(path.join(tmpDir, '.aider.conf.yml'), 'utf8'),
    ) as any;
    expect(cfg.read).toContain('custom_aider.md');
  });

  describe('FirebaseAgent', () => {
  it('backs up and writes .idx/airules.md', async () => {
      const agent = new FirebaseAgent();
      const idxDir = path.join(tmpDir, '.idx');
      await fs.mkdir(idxDir, { recursive: true });
      const target = path.join(idxDir, 'airules.md');
      await fs.writeFile(target, 'old firebase');
      await agent.applyRulerConfig('new firebase', tmpDir, null);
      expect(await fs.readFile(`${target}.bak`, 'utf8')).toBe('old firebase');
      expect(await fs.readFile(target, 'utf8')).toBe('new firebase');
    });
  });
  it('uses custom outputPath when provided', async () => {
    const agent = new FirebaseAgent();
    const custom = path.join(tmpDir, 'custom_firebase.md');
    await fs.mkdir(path.dirname(custom), { recursive: true });
    await agent.applyRulerConfig('firebase rules', tmpDir, null, { outputPath: custom });
    expect(await fs.readFile(custom, 'utf8')).toBe('firebase rules');
  });

  describe('JunieAgent', () => {
  it('backs up and writes .junie/guidelines.md', async () => {
      const agent = new JunieAgent();
      const junieDir = path.join(tmpDir, '.junie');
      await fs.mkdir(junieDir, { recursive: true });
      const target = path.join(junieDir, 'guidelines.md');
      await fs.writeFile(target, 'old junie');
      await agent.applyRulerConfig('new junie', tmpDir, null);
      expect(await fs.readFile(`${target}.bak`, 'utf8')).toBe('old junie');
      expect(await fs.readFile(target, 'utf8')).toBe('new junie');
    });
  });
  it('uses custom outputPath when provided', async () => {
    const agent = new JunieAgent();
    const custom = path.join(tmpDir, 'custom_junie.md');
    await fs.mkdir(path.dirname(custom), { recursive: true });
    await agent.applyRulerConfig('junie rules', tmpDir, null, { outputPath: custom });
    expect(await fs.readFile(custom, 'utf8')).toBe('junie rules');
  });

  describe('AugmentCodeAgent', () => {
    it('backs up and writes ruler_augment_instructions.md', async () => {
      const agent = new AugmentCodeAgent();
      const target = path.join(tmpDir, '.augment', 'rules', 'ruler_augment_instructions.md');
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, 'old augment');
      await agent.applyRulerConfig('new augment', tmpDir, null);
      expect(await fs.readFile(`${target}.bak`, 'utf8')).toBe('old augment');
      expect(await fs.readFile(target, 'utf8')).toBe('new augment');
    });

    it('uses custom outputPath when provided', async () => {
      const agent = new AugmentCodeAgent();
      const custom = path.join(tmpDir, 'custom_augment.md');
      await fs.mkdir(path.dirname(custom), { recursive: true });
      await agent.applyRulerConfig('augment rules', tmpDir, null, { outputPath: custom });
      expect(await fs.readFile(custom, 'utf8')).toBe('augment rules');
    });
  });
});
