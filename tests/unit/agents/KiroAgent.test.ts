import { promises as fs } from 'fs';
import * as path from 'path';
import { KiroAgent } from '../../../src/agents/KiroAgent';
import { AbstractAgent } from '../../../src/agents/AbstractAgent';
import { setupTestProject, teardownTestProject } from '../../harness';

describe('KiroAgent', () => {
  it('should be defined', () => {
    expect(new KiroAgent()).toBeDefined();
  });

  it('should extend AbstractAgent', () => {
    const agent = new KiroAgent();
    expect(agent instanceof AbstractAgent).toBe(true);
  });

  it('should have the correct identifier', () => {
    const agent = new KiroAgent();
    expect(agent.getIdentifier()).toBe('kiro');
  });

  it('should have the correct name', () => {
    const agent = new KiroAgent();
    expect(agent.getName()).toBe('Kiro');
  });

  it('should support MCP stdio', () => {
    const agent = new KiroAgent();
    expect(agent.supportsMcpStdio()).toBe(true);
  });

  it('should support MCP remote', () => {
    const agent = new KiroAgent();
    expect(agent.supportsMcpRemote()).toBe(true);
  });

  it('should have the correct default output path', () => {
    const agent = new KiroAgent();
    const projectRoot = '/test/project';
    expect(agent.getDefaultOutputPath(projectRoot)).toBe(
      path.join(projectRoot, '.kiro', 'steering', 'ruler_kiro_instructions.md'),
    );
  });

  it('writes rules to .kiro/steering/ruler_kiro_instructions.md file', async () => {
    const { projectRoot } = await setupTestProject({
      '.ruler/AGENTS.md': 'Rule A',
    });
    try {
      const agent = new KiroAgent();
      const rules = 'Combined rules\n- Rule A';

      await agent.applyRulerConfig(rules, projectRoot, null);

      // ruler_kiro_instructions.md should be written at .kiro/steering/
      const kiroInstructionsPath = path.join(
        projectRoot,
        '.kiro',
        'steering',
        'ruler_kiro_instructions.md',
      );
      const content = await fs.readFile(kiroInstructionsPath, 'utf8');
      expect(content).toContain('Rule A');
    } finally {
      await teardownTestProject(projectRoot);
    }
  });
});
