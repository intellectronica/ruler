import { promises as fs } from 'fs';
import * as path from 'path';
import { loadUnifiedConfig } from '../../../src/core/UnifiedConfigLoader';

describe('UnifiedConfigLoader (hooks)', () => {
  const tmpRoot = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'tmp-fixtures',
    'unified-hooks',
  );
  const rulerDir = path.join(tmpRoot, '.ruler');
  const tomlPath = path.join(rulerDir, 'ruler.toml');

  beforeAll(async () => {
    await fs.mkdir(rulerDir, { recursive: true });
    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), '# AGENTS\\nMain');
  });

  afterAll(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  test('parses hooks config from TOML', async () => {
    await fs.writeFile(
      tomlPath,
      `
[hooks]
enabled = true
merge_strategy = "overwrite"
source = ".ruler/hooks.json"
`,
    );

    const unified = await loadUnifiedConfig({ projectRoot: tmpRoot });
    expect(unified.toml.hooks).toBeDefined();
    expect(unified.toml.hooks?.enabled).toBe(true);
    expect(unified.toml.hooks?.strategy).toBe('overwrite');
    expect(unified.toml.hooks?.source).toBe('.ruler/hooks.json');
  });

  test('defaults hooks to undefined when not specified', async () => {
    await fs.writeFile(tomlPath, '');

    const unified = await loadUnifiedConfig({ projectRoot: tmpRoot });
    expect(unified.toml.hooks).toBeUndefined();
  });
});
