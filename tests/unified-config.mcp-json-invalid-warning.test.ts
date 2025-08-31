import { setupTestProject, teardownTestProject } from './harness';

/**
 * Ensures diagnostic still appears for legacy mcp.json even if file contains invalid JSON.
 */
describe('legacy mcp.json invalid still warns', () => {
  let testProject: { projectRoot: string };

  beforeEach(async () => {
    // Invalid JSON content
    testProject = await setupTestProject({
      '.ruler/mcp.json': '{ invalid: true ',
    });
  });

  afterEach(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('creates diagnostic even with invalid JSON', async () => {
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
