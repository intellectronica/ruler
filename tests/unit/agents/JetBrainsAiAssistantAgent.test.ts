import { promises as fs } from 'fs';
import * as path from 'path';
import { JetBrainsAiAssistantAgent } from '../../../src/agents/JetBrainsAiAssistantAgent';
import { AbstractAgent } from '../../../src/agents/AbstractAgent';
import { setupTestProject, teardownTestProject } from '../../harness';

describe('JetBrainsAiAssistantAgent', () => {
  it('should be defined', () => {
    expect(new JetBrainsAiAssistantAgent()).toBeDefined();
  });

  it('should extend AbstractAgent', () => {
    const agent = new JetBrainsAiAssistantAgent();
    expect(agent instanceof AbstractAgent).toBe(true);
  });

  it('should have the correct identifier', () => {
    const agent = new JetBrainsAiAssistantAgent();
    expect(agent.getIdentifier()).toBe('jetbrains-ai');
  });

  it('should have the correct name', () => {
    const agent = new JetBrainsAiAssistantAgent();
    expect(agent.getName()).toBe('JetBrains AI Assistant');
  });

  it('should have the correct default output path', () => {
    const agent = new JetBrainsAiAssistantAgent();
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
      const agent = new JetBrainsAiAssistantAgent();
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
