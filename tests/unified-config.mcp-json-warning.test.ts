import * as path from 'path';
import { setupTestProject, teardownTestProject } from './harness';

/**
 * Verifies that using legacy .ruler/mcp.json creates a structured diagnostic warning
 * instructing migration to ruler.toml.
 */
describe('legacy mcp.json warning', () => {
  let testProject: { projectRoot: string };

  beforeEach(async () => {
    const toml = `[mcp]\nenabled = true\n\n[mcp_servers.local]\ncommand = "echo"\nargs = ["hi"]\n`;
    const json = { mcpServers: { legacy: { command: 'echo', args: ['old'] } } };

    testProject = await setupTestProject({
      '.ruler/ruler.toml': toml,
      '.ruler/mcp.json': JSON.stringify(json, null, 2)
    });
  });

  afterEach(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('creates structured diagnostic for legacy mcp.json', async () => {
    const { projectRoot } = testProject;
    const { loadUnifiedConfig } = require('../dist/core/UnifiedConfigLoader');
    const config = await loadUnifiedConfig({ projectRoot });
    
    const deprecationDiagnostic = config.diagnostics.find((d: any) => 
      d.code === 'MCP_JSON_DEPRECATED'
    );
    expect(deprecationDiagnostic).toBeTruthy();
    expect(deprecationDiagnostic.severity).toBe('warning');
    expect(deprecationDiagnostic.message).toContain('mcp.json detected');
  });
});
