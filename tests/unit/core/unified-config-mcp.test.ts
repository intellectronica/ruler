import * as path from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import { loadUnifiedConfig } from '../../../src/core/UnifiedConfigLoader';
import { validateMcp } from '../../../src/mcp/validate';

// Uses existing integration fixture for simplicity

describe('UnifiedConfigLoader MCP normalization', () => {
  // From tests/unit/core -> go up to tests, then into integration/fixtures/unified
  const projectRoot = path.join(
    __dirname,
    '../../integration/fixtures/unified',
  );
  test('normalizes mcp.json servers', async () => {
    const unified = await loadUnifiedConfig({ projectRoot });
    // Expect non-null after implementation
    expect(unified.mcp).not.toBeNull();
    expect(unified.mcp?.servers.example.command).toBe('node');
  });

  test('warns when legacy mcp.json has an invalid server map shape', async () => {
    const tmpRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ruler-unified-mcp-'),
    );
    const rulerDir = path.join(tmpRoot, '.ruler');
    await fs.mkdir(rulerDir, { recursive: true });
    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), '# Rules');
    await fs.writeFile(
      path.join(rulerDir, 'mcp.json'),
      JSON.stringify({ mcpServers: null }),
    );

    try {
      const unified = await loadUnifiedConfig({ projectRoot: tmpRoot });
      expect(unified.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'MCP_INVALID_SHAPE',
            file: path.join(rulerDir, 'mcp.json'),
          }),
        ]),
      );
      expect(unified.mcp?.servers).toEqual({});
    } finally {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  test('rejects null and array mcpServers in legacy validator', () => {
    expect(() => validateMcp({ mcpServers: null })).toThrow(
      /must contain an object property/,
    );
    expect(() => validateMcp({ mcpServers: [] })).toThrow(
      /must contain an object property/,
    );
  });
});
