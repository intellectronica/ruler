import { promises as fs } from 'fs';
import * as path from 'path';
import { loadUnifiedConfig } from '../../../src/core/UnifiedConfigLoader';

describe('UnifiedConfigLoader (skills)', () => {
  const tmpRoot = path.join(__dirname, '..', '..', '..', 'tmp-fixtures', 'unified-skills');
  const rulerDir = path.join(tmpRoot, '.ruler');
  const tomlPath = path.join(rulerDir, 'ruler.toml');

  beforeAll(async () => {
    await fs.mkdir(rulerDir, { recursive: true });
    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), '# AGENTS\\nMain');
  });

  afterAll(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  test('parses skills.enabled from TOML', async () => {
    await fs.writeFile(
      tomlPath,
      `
[skills]
enabled = false
`,
    );

    const unified = await loadUnifiedConfig({ projectRoot: tmpRoot });
    expect(unified.toml.skills).toBeDefined();
    expect(unified.toml.skills?.enabled).toBe(false);
  });

  test('defaults skills.enabled to undefined when not specified', async () => {
    await fs.writeFile(tomlPath, '');

    const unified = await loadUnifiedConfig({ projectRoot: tmpRoot });
    expect(unified.toml.skills).toBeUndefined();
  });

  test('respects skills.enabled = true', async () => {
    await fs.writeFile(
      tomlPath,
      `
[skills]
enabled = true
`,
    );

    const unified = await loadUnifiedConfig({ projectRoot: tmpRoot });
    expect(unified.toml.skills).toBeDefined();
    expect(unified.toml.skills?.enabled).toBe(true);
  });
});
