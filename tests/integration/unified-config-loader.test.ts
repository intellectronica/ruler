import * as path from 'path';
import { loadUnifiedConfig } from '../../src/core/UnifiedConfigLoader';

describe('UnifiedConfigLoader integration', () => {
  const projectRoot = path.join(__dirname, 'fixtures', 'unified');
  test('loads config and rules (MCP normalization pending)', async () => {
    const unified = await loadUnifiedConfig({ projectRoot });
    expect(unified.toml.defaultAgents).toEqual(['copilot']);
    expect(unified.rules.files.map(f => f.relativePath)).toEqual(['AGENTS.md', 'extra.md']);
  });
});

// Separate test for MCP once implemented

