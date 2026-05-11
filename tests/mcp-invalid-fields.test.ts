import * as fs from 'fs/promises';
import * as path from 'path';
import { setupTestProject, teardownTestProject } from './harness';

describe('mcp-invalid-fields', () => {
  let testProject: { projectRoot: string };

  afterEach(async () => {
    if (testProject) {
      await teardownTestProject(testProject.projectRoot);
    }
  });

  it('handles server with both command and url (validation error)', async () => {
    const toml = `[mcp]
enabled = true

[mcp_servers.invalid]
command = "node"
url = "https://example.com"
`;

    testProject = await setupTestProject({
      '.ruler/ruler.toml': toml
    });

    const { projectRoot } = testProject;
    const { loadUnifiedConfig } = require('../dist/core/UnifiedConfigLoader');
    const config = await loadUnifiedConfig({ projectRoot });

    const fieldConflictError = config.diagnostics.find((d: any) => 
      d.code === 'MCP_TOML_FIELD_CONFLICT'
    );
    expect(fieldConflictError).toBeTruthy();
    expect(fieldConflictError.severity).toBe('warning');
    expect(fieldConflictError.message).toContain('both command and url');
  });

  it('handles headers with command (validation error)', async () => {
    const toml = `[mcp]
enabled = true

[mcp_servers.invalid]
command = "node"
headers = { Authorization = "Bearer token" }
`;

    testProject = await setupTestProject({
      '.ruler/ruler.toml': toml
    });

    const { projectRoot } = testProject;
    const { loadUnifiedConfig } = require('../dist/core/UnifiedConfigLoader');
    const config = await loadUnifiedConfig({ projectRoot });

    const fieldConflictError = config.diagnostics.find((d: any) => 
      d.code === 'MCP_TOML_FIELD_CONFLICT'
    );
    expect(fieldConflictError).toBeTruthy();
    expect(fieldConflictError.severity).toBe('warning');
    expect(fieldConflictError.message).toContain('headers');
  });

  it('handles env with url (validation error)', async () => {
    const toml = `[mcp]
enabled = true

[mcp_servers.invalid]
url = "https://example.com"
env = { API_KEY = "secret" }
`;

    testProject = await setupTestProject({
      '.ruler/ruler.toml': toml
    });

    const { projectRoot } = testProject;
    const { loadUnifiedConfig } = require('../dist/core/UnifiedConfigLoader');
    const config = await loadUnifiedConfig({ projectRoot });

    const fieldConflictError = config.diagnostics.find((d: any) => 
      d.code === 'MCP_TOML_FIELD_CONFLICT'
    );
    expect(fieldConflictError).toBeTruthy();
    expect(fieldConflictError.severity).toBe('warning');
    expect(fieldConflictError.message).toContain('env');
  });

  it('handles server with neither command nor url', async () => {
    const toml = `[mcp]
enabled = true

[mcp_servers.invalid]
args = ["some", "args"]
`;

    testProject = await setupTestProject({
      '.ruler/ruler.toml': toml
    });

    const { projectRoot } = testProject;
    const { loadUnifiedConfig } = require('../dist/core/UnifiedConfigLoader');
    const config = await loadUnifiedConfig({ projectRoot });

    const invalidServerError = config.diagnostics.find((d: any) => 
      d.code === 'MCP_TOML_INVALID_SERVER'
    );
    expect(invalidServerError).toBeTruthy();
    expect(invalidServerError.severity).toBe('warning');
    expect(invalidServerError.message).toContain('must have at least one of command or url');
  });
});