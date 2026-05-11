import { promises as fs } from 'fs';
import * as path from 'path';
import { ClaudeAgent } from '../../../src/agents/ClaudeAgent';
import { AbstractAgent } from '../../../src/agents/AbstractAgent';
import { setupTestProject, teardownTestProject } from '../../harness';

describe('ClaudeAgent', () => {
  it('should be defined', () => {
    expect(new ClaudeAgent()).toBeDefined();
  });

  it('should extend AbstractAgent', () => {
    const agent = new ClaudeAgent();
    expect(agent instanceof AbstractAgent).toBe(true);
  });

  it('should have the correct identifier', () => {
    const agent = new ClaudeAgent();
    expect(agent.getIdentifier()).toBe('claude');
  });

  it('should have the correct name', () => {
    const agent = new ClaudeAgent();
    expect(agent.getName()).toBe('Claude Code');
  });

  it('should support MCP stdio and remote', () => {
    const agent = new ClaudeAgent();
    expect(agent.supportsMcpStdio()).toBe(true);
    expect(agent.supportsMcpRemote()).toBe(true);
  });

  it('should have the correct default output path', () => {
    const agent = new ClaudeAgent();
    const projectRoot = '/test/project';
    expect(agent.getDefaultOutputPath(projectRoot)).toBe(path.join(projectRoot, 'CLAUDE.md'));
  });

  it('writes rules to CLAUDE.md file', async () => {
    const { projectRoot } = await setupTestProject({
      '.ruler/AGENTS.md': 'Rule A',
    });
    try {
      const agent = new ClaudeAgent();
      const rules = 'Combined rules\n- Rule A';

      await agent.applyRulerConfig(rules, projectRoot, null);

      // CLAUDE.md should be written at the repository root
      const claudeMdPath = path.join(projectRoot, 'CLAUDE.md');
      const content = await fs.readFile(claudeMdPath, 'utf8');
      expect(content).toContain('Rule A');
    } finally {
      await teardownTestProject(projectRoot);
    }
  });
});