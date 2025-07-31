
import { CrushAgent } from '../../../src/agents/CrushAgent';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('CrushAgent', () => {
  const projectRoot = '/tmp/test-project';
  const agent = new CrushAgent();

  beforeEach(async () => {
    await fs.mkdir(projectRoot, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it('should return the correct identifier', () => {
    expect(agent.getIdentifier()).toBe('crush');
  });

  it('should return the correct name', () => {
    expect(agent.getName()).toBe('Crush');
  });

  it('should return the correct output paths', () => {
    const outputPaths = agent.getDefaultOutputPath(projectRoot);
    expect(outputPaths).toEqual({
      instructions: path.join(projectRoot, 'CRUSH.md'),
      mcp: path.join(projectRoot, '.crush.json'),
    });
  });

  it('should create CRUSH.md and .crush.json with ruler config', async () => {
    const rules = 'some rules';
    const mcpJson = { mcpServers: { 'test-mcp': { command: 'echo' } } };
    await agent.applyRulerConfig(rules, projectRoot, mcpJson);

    const instructionsPath = path.join(projectRoot, 'CRUSH.md');
    const mcpPath = path.join(projectRoot, '.crush.json');

    const instructionsContent = await fs.readFile(instructionsPath, 'utf-8');
    const mcpContent = JSON.parse(await fs.readFile(mcpPath, 'utf-8'));

    expect(instructionsContent).toBe(rules);
    expect(mcpContent).toEqual({
      mcp: { 'test-mcp': { command: 'echo' } },
    });
  });

  it('should update .crush.json with new mcp servers', async () => {
    const initialMcp = {
      mcp: {
        'existing-mcp': { command: 'ls' },
      },
    };
    const mcpPath = path.join(projectRoot, '.crush.json');
    await fs.writeFile(mcpPath, JSON.stringify(initialMcp, null, 2));

    const rules = 'new rules';
    const newMcpJson = { mcpServers: { 'new-mcp': { command: 'pwd' } } };
    await agent.applyRulerConfig(rules, projectRoot, newMcpJson);

    const updatedMcpContent = JSON.parse(await fs.readFile(mcpPath, 'utf-8'));

    expect(updatedMcpContent).toEqual({
      mcp: {
        'existing-mcp': { command: 'ls' },
        'new-mcp': { command: 'pwd' },
      },
    });
  });
});
