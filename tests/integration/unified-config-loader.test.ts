import * as path from 'path';
import { promises as fs } from 'fs';
import { loadUnifiedConfig } from '../../src/core/UnifiedConfigLoader';

describe('UnifiedConfigLoader integration', () => {
  const projectRoot = path.join(__dirname, 'fixtures', 'unified');
  test('loads config and rules (MCP normalization pending)', async () => {
    // In CI, AGENTS.md test fixture may be absent because root .gitignore ignores AGENTS.md.
    // Ensure presence so ordering assertion remains deterministic.
    const agentsPath = path.join(projectRoot, '.ruler', 'AGENTS.md');
    try {
      await fs.access(agentsPath);
    } catch {
      await fs.writeFile(agentsPath, '# Primary Rules\nLine A', 'utf8');
    }
    const unified = await loadUnifiedConfig({ projectRoot });
    expect(unified.toml.defaultAgents).toEqual(['copilot']);
    expect(unified.rules.files.map((f) => f.relativePath)).toEqual([
      'AGENTS.md',
      'extra.md',
    ]);
  });
});

// Separate test for MCP once implemented

