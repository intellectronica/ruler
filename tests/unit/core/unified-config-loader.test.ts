import { promises as fs } from 'fs';
import * as path from 'path';

// The loader will be implemented later; import path placeholder to satisfy TS for now.
// eslint-disable-next-line @typescript-eslint/no-var-requires

describe('UnifiedConfigLoader (TDD skeleton)', () => {
  const tmpRoot = path.join(__dirname, '..', '..', '..', 'tmp-fixtures', 'unified-basic');
  const rulerDir = path.join(tmpRoot, '.ruler');
  const tomlPath = path.join(rulerDir, 'ruler.toml');

  beforeAll(async () => {
    await fs.mkdir(rulerDir, { recursive: true });
    await fs.writeFile(tomlPath, ''); // empty TOML
    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), '# AGENTS\nMain');
    await fs.writeFile(path.join(rulerDir, 'extra.md'), 'Extra file');
  });

  test('parses empty TOML producing defaults (placeholder expectation)', async () => {
    // Once implemented we will load and assert structure.
    // For now, fail explicitly to ensure test turns green only after implementation.
    expect(false).toBe(true);
  });

  test('orders rule files with AGENTS.md first', async () => {
    expect(false).toBe(true);
  });
});
