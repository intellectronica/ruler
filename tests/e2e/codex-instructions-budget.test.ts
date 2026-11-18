import * as fs from 'fs/promises';
import * as path from 'path';
import { runRulerAll, teardownTestProject } from '../harness';

it('reports the actual oversized Codex rules file when using a relative project root', async () => {
  const rules = '界'.repeat(12_000) + '\nFinal instruction';
  const projectRoot = await fs.mkdtemp('ruler-relative-');

  try {
    const rulerDir = path.join(projectRoot, '.ruler');
    await fs.mkdir(rulerDir);
    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), rules, 'utf8');

    const output = runRulerAll(
      'apply --agents codex --local-only',
      projectRoot,
    );
    const files = await fs.readdir(projectRoot, { recursive: true });
    const generatedFiles = files.filter(
      (file) =>
        path.basename(file) === 'AGENTS.md' && path.dirname(file) !== '.ruler',
    );
    expect(generatedFiles).toHaveLength(1);
    const generatedPath = path.resolve(projectRoot, generatedFiles[0]);
    const generated = await fs.readFile(generatedPath, 'utf8');

    expect(generated).toContain(rules);
    expect(generated.length).toBeLessThan(32768);
    expect(output).toContain(
      `${generatedPath} use ${Buffer.byteLength(generated)} bytes`,
    );
    expect(output).toContain('32 KiB');
    expect(output).toContain('project_doc_max_bytes');
  } finally {
    await teardownTestProject(projectRoot);
  }
});
