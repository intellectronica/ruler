import { promises as fs } from 'fs';
import * as path from 'path';
import os from 'os';
import { OpenCodeAgent } from '../../../src/agents/OpenCodeAgent';

describe('OpenCodeAgent', () => {
  let tmpDir: string;
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-opencode-'));
  });
  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should have correct identifier', () => {
    const agent = new OpenCodeAgent();
    expect(agent.getIdentifier()).toBe('opencode');
  });

  it('should have correct name', () => {
    const agent = new OpenCodeAgent();
    expect(agent.getName()).toBe('OpenCode');
  });

  it('should return correct default output path', () => {
    const agent = new OpenCodeAgent();
    expect(agent.getDefaultOutputPath('/test/project')).toBe(
      path.join('/test/project', 'AGENTS.md')
    );
  });

  it('should return correct MCP server key', () => {
    const agent = new OpenCodeAgent();
    expect(agent.getMcpServerKey()).toBe('mcp');
  });

  it('backs up and writes AGENTS.md with OpenCode header', async () => {
    const agent = new OpenCodeAgent();
    const target = path.join(tmpDir, 'AGENTS.md');
    await fs.writeFile(target, 'old content');
    await agent.applyRulerConfig('new custom rules', tmpDir, null);
    
    const backup = await fs.readFile(`${target}.bak`, 'utf8');
    const content = await fs.readFile(target, 'utf8');
    
    expect(backup).toBe('old content');
    expect(content).toContain('# opencode agent guidelines');
    expect(content).toContain('new custom rules');
    expect(content).toContain('Build/Test Commands');
    expect(content).toContain('bun install');
    expect(content).toContain('Code Style');
    expect(content).toContain('IMPORTANT');
    expect(content).toContain('Architecture');
  });

  it('uses custom outputPath when provided', async () => {
    const agent = new OpenCodeAgent();
    const custom = path.join(tmpDir, 'custom_opencode.md');
    await fs.mkdir(path.dirname(custom), { recursive: true });
    await agent.applyRulerConfig('test content', tmpDir, null, { outputPath: custom });
    
    const content = await fs.readFile(custom, 'utf8');
    expect(content).toContain('# opencode agent guidelines');
    expect(content).toContain('test content');
  });

  it('creates directory if it does not exist', async () => {
    const agent = new OpenCodeAgent();
    const nestedPath = path.join(tmpDir, 'nested', 'dir', 'AGENTS.md');
    await agent.applyRulerConfig('test content', tmpDir, null, { outputPath: nestedPath });
    
    const content = await fs.readFile(nestedPath, 'utf8');
    expect(content).toContain('# opencode agent guidelines');
    expect(content).toContain('test content');
  });

  it('includes all OpenCode-specific sections in header', async () => {
    const agent = new OpenCodeAgent();
    const target = path.join(tmpDir, 'AGENTS.md');
    await agent.applyRulerConfig('custom rules', tmpDir, null);
    
    const content = await fs.readFile(target, 'utf8');
    
    // Check for all major sections
    expect(content).toContain('## Build/Test Commands');
    expect(content).toContain('## Code Style');
    expect(content).toContain('## IMPORTANT');
    expect(content).toContain('## Architecture');
    
    // Check for specific content
    expect(content).toContain('bun run typecheck');
    expect(content).toContain('Zod schemas for validation');
    expect(content).toContain('AVOID `try`/`catch` where possible');
    expect(content).toContain('Tool.Info` interface');
    expect(content).toContain('# Custom Project Instructions');
  });
});