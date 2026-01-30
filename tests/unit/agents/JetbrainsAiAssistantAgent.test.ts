import { promises as fs } from 'fs';
import * as path from 'path';
import { JetbrainsAiAssistantAgent } from '../../../src/agents/JetbrainsAiAssistantAgent';
import { AbstractAgent } from '../../../src/agents/AbstractAgent';
import { setupTestProject, teardownTestProject } from '../../harness';

describe('JetbrainsAiAssistantAgent', () => {
  it('should be defined', () => {
    expect(new JetbrainsAiAssistantAgent()).toBeDefined();
  });

  it('should extend AbstractAgent', () => {
    const agent = new JetbrainsAiAssistantAgent();
    expect(agent instanceof AbstractAgent).toBe(true);
  });

  it('should have the correct identifier', () => {
    const agent = new JetbrainsAiAssistantAgent();
    expect(agent.getIdentifier()).toBe('jetbrains-ai');
  });

  it('should have the correct name', () => {
    const agent = new JetbrainsAiAssistantAgent();
    expect(agent.getName()).toBe('JetBrains AI Assistant');
  });

  it('should have the correct default output path', () => {
    const agent = new JetbrainsAiAssistantAgent();
    const projectRoot = '/test/project';
    expect(agent.getDefaultOutputPath(projectRoot)).toBe(
      path.join(projectRoot, '.aiassistant', 'rules', 'AGENTS.md'),
    );
  });

  it('writes rules to .aiassistant/rules/AGENTS.md', async () => {
    const { projectRoot } = await setupTestProject({
      '.ruler/AGENTS.md': 'Rule A',
    });
    try {
      const agent = new JetbrainsAiAssistantAgent();
      const rules = 'Combined rules\n- Rule A';

      await agent.applyRulerConfig(rules, projectRoot, null);

      const outputPath = path.join(
        projectRoot,
        '.aiassistant',
        'rules',
        'AGENTS.md',
      );
      const content = await fs.readFile(outputPath, 'utf8');
      expect(content).toContain('Rule A');
    } finally {
      await teardownTestProject(projectRoot);
    }
  });
});
