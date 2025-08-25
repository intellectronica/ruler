import { promises as fs } from 'fs';
import * as path from 'path';
import { loadUnifiedConfig } from '../../../src/core/UnifiedConfigLoader';

describe('UnifiedConfigLoader (basic)', () => {
  const tmpRoot = path.join(__dirname, '..', '..', '..', 'tmp-fixtures', 'unified-basic');
  const rulerDir = path.join(tmpRoot, '.ruler');
  const tomlPath = path.join(rulerDir, 'ruler.toml');

  beforeAll(async () => {
    await fs.mkdir(rulerDir, { recursive: true });
    await fs.writeFile(tomlPath, ''); // empty TOML
    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), '# AGENTS\nMain');
    await fs.writeFile(path.join(rulerDir, 'extra.md'), 'Extra file');
  });

  test('parses empty TOML producing defaults', async () => {
    const unified = await loadUnifiedConfig({ projectRoot: tmpRoot });
    expect(unified.toml.defaultAgents).toBeUndefined();
    expect(Object.keys(unified.toml.agents)).toHaveLength(0);
    expect(unified.rules.files.length).toBe(2);
  });

  test('orders rule files with AGENTS.md first', async () => {
    const unified = await loadUnifiedConfig({ projectRoot: tmpRoot });
    expect(unified.rules.files[0].relativePath).toMatch(/AGENTS\.md$/);
  const rels = unified.rules.files.map((f) => f.relativePath);
    expect(rels).toEqual(['AGENTS.md', 'extra.md']);
  expect(unified.rules.concatenated).toMatch(/<!-- Source: \.ruler\/AGENTS.md -->[\s\S]*<!-- Source: \.ruler\/extra.md -->/);
  });
});
