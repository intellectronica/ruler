import * as fs from 'fs/promises';
import * as path from 'path';
import { runRuler, setupTestProject, teardownTestProject } from '../harness';

describe('Configured markdown outputs under .ruler', () => {
  let projectRoot: string;
  const outputRelativePath = '.ruler/.generated/codex-instructions.md';

  beforeEach(async () => {
    const project = await setupTestProject({
      '.ruler/AGENTS.md': 'Base rules for Codex',
      '.ruler/ruler.toml': `default_agents = ["codex"]

[agents.codex]
enabled = true
output_path = ".ruler/.generated/codex-instructions.md"
`,
    });
    projectRoot = project.projectRoot;
  });

  afterEach(async () => {
    await teardownTestProject(projectRoot);
  });

  it('does not re-consume configured generated markdown outputs on subsequent applies', async () => {
    runRuler(
      'apply --agents codex --no-gitignore --no-backup --no-skills --no-subagents --local-only',
      projectRoot,
    );
    const outputPath = path.join(projectRoot, outputRelativePath);
    const firstOutput = await fs.readFile(outputPath, 'utf8');

    runRuler(
      'apply --agents codex --no-gitignore --no-backup --no-skills --no-subagents --local-only',
      projectRoot,
    );
    const secondOutput = await fs.readFile(outputPath, 'utf8');

    expect(secondOutput).toBe(firstOutput);
    expect(secondOutput).toContain('Base rules for Codex');
    expect(secondOutput).not.toContain(
      '<!-- Source: .ruler/.generated/codex-instructions.md -->',
    );
  });
});
