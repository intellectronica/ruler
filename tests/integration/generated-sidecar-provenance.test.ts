import * as fs from 'fs/promises';
import * as path from 'path';
import { runRuler, setupTestProject, teardownTestProject } from '../harness';

describe('generated sidecar provenance', () => {
  it.each([
    {
      agent: 'qwen',
      sidecarPath: path.join('.qwen', 'settings.json'),
    },
    {
      agent: 'aider',
      sidecarPath: '.aider.conf.yml',
    },
    {
      agent: 'firebender',
      sidecarPath: 'firebender.json',
    },
  ])(
    'reverts generated $agent sidecars without backups or gitignore tracking',
    async ({ agent, sidecarPath }) => {
      const project = await setupTestProject({
        '.ruler/AGENTS.md': 'Rule A',
      });
      const fullSidecarPath = path.join(project.projectRoot, sidecarPath);
      const provenancePath = `${fullSidecarPath}.ruler-generated`;

      try {
        runRuler(
          `apply --agents ${agent} --no-mcp --no-backup --no-gitignore`,
          project.projectRoot,
        );

        await expect(fs.access(fullSidecarPath)).resolves.toBeUndefined();
        await expect(fs.access(provenancePath)).resolves.toBeUndefined();
        await expect(
          fs.access(path.join(project.projectRoot, '.gitignore')),
        ).rejects.toThrow();

        runRuler(`revert --agents ${agent}`, project.projectRoot);

        await expect(fs.access(fullSidecarPath)).rejects.toThrow();
        await expect(fs.access(provenancePath)).rejects.toThrow();
      } finally {
        await teardownTestProject(project.projectRoot);
      }
    },
  );

  it('preserves a pre-existing unprovenanced sidecar', async () => {
    const originalConfig = 'read:\n  - USER.md\n';
    const project = await setupTestProject({
      '.ruler/AGENTS.md': 'Rule A',
      '.aider.conf.yml': originalConfig,
    });
    const sidecarPath = path.join(project.projectRoot, '.aider.conf.yml');
    const provenancePath = `${sidecarPath}.ruler-generated`;

    try {
      runRuler(
        'apply --agents aider --no-mcp --no-backup --no-gitignore',
        project.projectRoot,
      );

      await expect(fs.access(provenancePath)).rejects.toThrow();

      runRuler('revert --agents aider', project.projectRoot);

      await expect(fs.access(sidecarPath)).resolves.toBeUndefined();
      await expect(fs.access(provenancePath)).rejects.toThrow();
    } finally {
      await teardownTestProject(project.projectRoot);
    }
  });
});
