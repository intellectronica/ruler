import { promises as fs } from 'fs';
import * as path from 'path';
import { AntigravityAgent } from '../../../src/agents/AntigravityAgent';
import { AbstractAgent } from '../../../src/agents/AbstractAgent';
import { setupTestProject, teardownTestProject } from '../../harness';

describe('AntigravityAgent', () => {
  it('should be defined', () => {
    expect(new AntigravityAgent()).toBeDefined();
  });

  it('should extend AbstractAgent', () => {
    const agent = new AntigravityAgent();
    expect(agent instanceof AbstractAgent).toBe(true);
  });

  it('should have the correct identifier', () => {
    const agent = new AntigravityAgent();
    expect(agent.getIdentifier()).toBe('antigravity');
  });

  it('should have the correct name', () => {
    const agent = new AntigravityAgent();
    expect(agent.getName()).toBe('Antigravity');
  });

  it('should have the correct default output path', () => {
    const agent = new AntigravityAgent();
    const projectRoot = '/test/project';
    expect(agent.getDefaultOutputPath(projectRoot)).toBe(path.join(projectRoot, '.agent', 'rules', 'ruler.md'));
  });

  it('should not support MCP stdio', () => {
    const agent = new AntigravityAgent();
    expect(agent.supportsMcpStdio()).toBe(false);
  });

  it('should not support MCP remote', () => {
    const agent = new AntigravityAgent();
    expect(agent.supportsMcpRemote()).toBe(false);
  });

  it('should not support native skills', () => {
    const agent = new AntigravityAgent();
    expect(agent.supportsNativeSkills()).toBe(false);
  });

  it('writes rules to .agent/rules/ruler.md file', async () => {
    const { projectRoot } = await setupTestProject({
      '.ruler/AGENTS.md': 'Rule A',
    });
    try {
      const agent = new AntigravityAgent();
      const rules = 'Combined rules\n- Rule A';

      await agent.applyRulerConfig(rules, projectRoot, null);

      // .agent/rules/ruler.md should be written
      const rulesPath = path.join(projectRoot, '.agent', 'rules', 'ruler.md');
      const content = await fs.readFile(rulesPath, 'utf8');
      expect(content).toContain('Rule A');
    } finally {
      await teardownTestProject(projectRoot);
    }
  });
});
