import { promises as fs } from 'fs';
import * as path from 'path';
import { ClineAgent } from '../../../src/agents/ClineAgent';
import { AbstractAgent } from '../../../src/agents/AbstractAgent';
import { setupTestProject, teardownTestProject } from '../../harness';

describe('ClineAgent', () => {
  it('should be defined', () => {
    expect(new ClineAgent()).toBeDefined();
  });

  it('should extend AbstractAgent', () => {
    const agent = new ClineAgent();
    expect(agent instanceof AbstractAgent).toBe(true);
  });

  it('should have the correct identifier', () => {
    const agent = new ClineAgent();
    expect(agent.getIdentifier()).toBe('cline');
  });

  it('should have the correct name', () => {
    const agent = new ClineAgent();
    expect(agent.getName()).toBe('Cline');
  });

  it('should have the correct default output path', () => {
    const agent = new ClineAgent();
    const projectRoot = '/test/project';
    expect(agent.getDefaultOutputPath(projectRoot)).toBe(path.join(projectRoot, '.clinerules'));
  });

  it('writes rules to .clinerules file', async () => {
    const { projectRoot } = await setupTestProject({
      '.ruler/AGENTS.md': 'Rule A',
    });
    try {
      const agent = new ClineAgent();
      const rules = 'Combined rules\n- Rule A';

      await agent.applyRulerConfig(rules, projectRoot, null);

      // .clinerules should be written at the repository root
      const clinerulePath = path.join(projectRoot, '.clinerules');
      const content = await fs.readFile(clinerulePath, 'utf8');
      expect(content).toContain('Rule A');
    } finally {
      await teardownTestProject(projectRoot);
    }
  });
});