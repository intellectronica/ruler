import { promises as fs } from 'fs';
import * as path from 'path';
import os from 'os';
import { loadUnifiedConfig } from '../../../src/core/UnifiedConfigLoader';

describe('UnifiedConfigLoader (basic)', () => {
  let tmpRoot: string;
  let rulerDir: string;
  let tomlPath: string;

  beforeAll(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-unified-basic-'));
    rulerDir = path.join(tmpRoot, '.ruler');
    tomlPath = path.join(rulerDir, 'ruler.toml');
    await fs.mkdir(rulerDir, { recursive: true });
    await fs.mkdir(path.join(rulerDir, 'nested'), { recursive: true });
    await fs.mkdir(path.join(rulerDir, 'skills'), { recursive: true });
    await fs.writeFile(tomlPath, ''); // empty TOML
    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), '# AGENTS\nMain');
    await fs.writeFile(path.join(rulerDir, 'extra.md'), 'Extra file');
    await fs.writeFile(path.join(rulerDir, 'nested', 'deep.md'), 'Deep file');
    await fs.writeFile(path.join(rulerDir, 'skills', 'SKILL.md'), 'Skill file');
  });

  test('parses empty TOML producing defaults', async () => {
    const unified = await loadUnifiedConfig({ projectRoot: tmpRoot });
    expect(unified.toml.defaultAgents).toBeUndefined();
    expect(Object.keys(unified.toml.agents)).toHaveLength(0);
    expect(unified.rules.files.length).toBe(3);
  });

  test('orders rule files with AGENTS.md first', async () => {
    const unified = await loadUnifiedConfig({ projectRoot: tmpRoot });
    expect(unified.rules.files[0].relativePath).toMatch(/AGENTS\.md$/);
    const rels = unified.rules.files.map((f) => f.relativePath);
    expect(rels).toEqual(['AGENTS.md', 'extra.md', 'nested/deep.md']);
    expect(unified.rules.concatenated).toMatch(
      /<!-- Source: \.ruler\/AGENTS.md -->[\s\S]*<!-- Source: \.ruler\/extra.md -->[\s\S]*<!-- Source: \.ruler\/nested\/deep.md -->/,
    );
    expect(unified.rules.concatenated).not.toContain('Skill file');
  });

  test('reports an error diagnostic for an explicit missing config file', async () => {
    const missingConfig = path.join(rulerDir, 'missing.toml');
    const unified = await loadUnifiedConfig({
      projectRoot: tmpRoot,
      configPath: missingConfig,
    });

    expect(unified.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          code: 'TOML_READ_ERROR',
          file: missingConfig,
        }),
      ]),
    );
  });

  afterAll(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });
});
