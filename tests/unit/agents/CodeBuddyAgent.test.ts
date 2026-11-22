import { promises as fs } from 'fs';
import * as path from 'path';
import { CodeBuddyAgent } from '../../../src/agents/CodeBuddyAgent';
import { AbstractAgent } from '../../../src/agents/AbstractAgent';
import { setupTestProject, teardownTestProject } from '../../harness';

describe('CodeBuddyAgent', () => {
  it('should be defined', () => {
    expect(new CodeBuddyAgent()).toBeDefined();
  });

  it('should extend AbstractAgent', () => {
    const agent = new CodeBuddyAgent();
    expect(agent instanceof AbstractAgent).toBe(true);
  });

  it('should have the correct identifier', () => {
    const agent = new CodeBuddyAgent();
    expect(agent.getIdentifier()).toBe('codebuddy');
  });

  it('should have the correct name', () => {
    const agent = new CodeBuddyAgent();
    expect(agent.getName()).toBe('CodeBuddy');
  });

  it('should have the correct default output path', () => {
    const agent = new CodeBuddyAgent();
    const projectRoot = '/test/project';
    expect(agent.getDefaultOutputPath(projectRoot)).toBe(
      path.join(projectRoot, 'CODEBUDDY.md'),
    );
  });

  it('should support MCP stdio and remote with mcpServers key', () => {
    const agent = new CodeBuddyAgent();
    expect(agent.supportsMcpStdio()).toBe(true);
    expect(agent.supportsMcpRemote()).toBe(true);
    expect(agent.getMcpServerKey()).toBe('mcpServers');
  });

  it('should support native skills and native subagents', () => {
    const agent = new CodeBuddyAgent();
    expect(agent.supportsNativeSkills()).toBe(true);
    expect(agent.supportsNativeSubagents()).toBe(true);
  });

  it('writes rules to CODEBUDDY.md file', async () => {
    const { projectRoot } = await setupTestProject({
      '.ruler/AGENTS.md': 'Rule A',
    });
    try {
      const agent = new CodeBuddyAgent();
      const rules = 'Combined rules\n- Rule A';

      await agent.applyRulerConfig(rules, projectRoot, null);

      const codebuddyMdPath = path.join(projectRoot, 'CODEBUDDY.md');
      const content = await fs.readFile(codebuddyMdPath, 'utf8');
      expect(content).toContain('Rule A');
    } finally {
      await teardownTestProject(projectRoot);
    }
  });

  it('supports custom outputPath configuration', async () => {
    const { projectRoot } = await setupTestProject({
      '.ruler/AGENTS.md': 'Rule Custom',
    });
    try {
      const agent = new CodeBuddyAgent();
      const customPath = path.join(projectRoot, '.codebuddy', 'CODEBUDDY.md');

      await agent.applyRulerConfig('Rule Custom', projectRoot, null, {
        outputPath: customPath,
      });

      const content = await fs.readFile(customPath, 'utf8');
      expect(content).toBe('Rule Custom');
    } finally {
      await teardownTestProject(projectRoot);
    }
  });
});
