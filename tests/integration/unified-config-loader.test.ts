import * as path from 'path';
import { loadUnifiedConfig } from '../../src/core/UnifiedConfigLoader';

describe('UnifiedConfigLoader integration', () => {
  const projectRoot = path.join(__dirname, 'fixtures', 'unified');
  test('loads config, rules, and mcp servers', async () => {
    const unified = await loadUnifiedConfig({ projectRoot });
    expect(unified.toml.defaultAgents).toEqual(['copilot']);
    expect(unified.rules.files.map(f => f.relativePath)).toEqual(['AGENTS.md', 'extra.md']);
    // MCP not yet implemented -> expect null for now.
    expect(unified.mcp).toBeNull();
  });
});
