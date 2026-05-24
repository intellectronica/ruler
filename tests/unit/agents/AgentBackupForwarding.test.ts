import { promises as fs } from 'fs';
import * as path from 'path';
import { GeminiCliAgent } from '../../../src/agents/GeminiCliAgent';
import { IAgent } from '../../../src/agents/IAgent';
import { QwenCodeAgent } from '../../../src/agents/QwenCodeAgent';
import { ZedAgent } from '../../../src/agents/ZedAgent';
import { setupTestProject, teardownTestProject } from '../../harness';

const agents: Array<[string, () => IAgent]> = [
  ['Gemini CLI', () => new GeminiCliAgent()],
  ['Qwen Code', () => new QwenCodeAgent()],
  ['Zed', () => new ZedAgent()],
];

describe('agent AGENTS.md backup forwarding', () => {
  it.each(agents)(
    '%s respects disabled AGENTS.md backups',
    async (_name, createAgent) => {
      const { projectRoot } = await setupTestProject({
        '.ruler/AGENTS.md': 'Rule A',
        'AGENTS.md': 'Existing AGENTS.md content',
      });

      try {
        await createAgent().applyRulerConfig(
          'Combined rules\n- Rule A',
          projectRoot,
          null,
          undefined,
          false,
        );

        await expect(
          fs.access(path.join(projectRoot, 'AGENTS.md.bak')),
        ).rejects.toThrow();
        await expect(
          fs.readFile(path.join(projectRoot, 'AGENTS.md'), 'utf8'),
        ).resolves.toContain('Rule A');
      } finally {
        await teardownTestProject(projectRoot);
      }
    },
  );

  it.each(agents)(
    '%s creates AGENTS.md backups by default',
    async (_name, createAgent) => {
      const { projectRoot } = await setupTestProject({
        '.ruler/AGENTS.md': 'Rule A',
        'AGENTS.md': 'Existing AGENTS.md content',
      });

      try {
        await createAgent().applyRulerConfig(
          'Combined rules\n- Rule A',
          projectRoot,
          null,
        );

        await expect(
          fs.readFile(path.join(projectRoot, 'AGENTS.md.bak'), 'utf8'),
        ).resolves.toBe('Existing AGENTS.md content');
        await expect(
          fs.readFile(path.join(projectRoot, 'AGENTS.md'), 'utf8'),
        ).resolves.toContain('Rule A');
      } finally {
        await teardownTestProject(projectRoot);
      }
    },
  );
});
