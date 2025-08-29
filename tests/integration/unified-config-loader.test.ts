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

  test('loads nested configuration option', async () => {
    const unified = await loadUnifiedConfig({ projectRoot });
    expect(unified.toml.nested).toBe(false); // Default should be false

    // Test with nested = true in TOML
    const tomlPath = path.join(projectRoot, '.ruler', 'ruler.toml');
    const originalToml = await fs.readFile(tomlPath, 'utf8');
    const modifiedToml = `default_agents = ["copilot"]
nested = true

[agents.copilot]
output_path = "AGENTS.md"
`;
    await fs.writeFile(tomlPath, modifiedToml, 'utf8');

    try {
      const unifiedWithNested = await loadUnifiedConfig({ projectRoot });
      expect(unifiedWithNested.toml.nested).toBe(true);
    } finally {
      // Restore original TOML
      await fs.writeFile(tomlPath, originalToml, 'utf8');
    }
  });
});

// Separate test for MCP once implemented
