import * as fs from 'fs/promises';
import * as path from 'path';
import { setupTestProject, teardownTestProject, runRuler } from './harness';
import { loadUnifiedConfig } from '../src/core/UnifiedConfigLoader';

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
      '.ruler/ruler.toml': toml,
    });

    const { projectRoot } = testProject;
    const config = await loadUnifiedConfig({ projectRoot });

    const fieldConflictError = config.diagnostics.find(
      (d: any) => d.code === 'MCP_TOML_FIELD_CONFLICT',
    );
    expect(fieldConflictError).toBeTruthy();
    expect(fieldConflictError!.severity).toBe('warning');
    expect(fieldConflictError!.message).toContain('both command and url');
  });

  it('handles headers with command (validation error)', async () => {
    const toml = `[mcp]
enabled = true

[mcp_servers.invalid]
command = "node"
headers = { Authorization = "Bearer token" }
`;

    testProject = await setupTestProject({
      '.ruler/ruler.toml': toml,
    });

    const { projectRoot } = testProject;
    const config = await loadUnifiedConfig({ projectRoot });

    const fieldConflictError = config.diagnostics.find(
      (d: any) => d.code === 'MCP_TOML_FIELD_CONFLICT',
    );
    expect(fieldConflictError).toBeTruthy();
    expect(fieldConflictError!.severity).toBe('warning');
    expect(fieldConflictError!.message).toContain('headers');
  });

  it('normalizes stdio servers by removing remote-only fields after diagnostics', async () => {
    const toml = `[mcp]
enabled = true

[mcp_servers.invalid]
command = "node"
args = ["server.js"]
headers = { Authorization = "Bearer token" }
auth = { token = "remote-auth" }
oauth = { clientId = "remote-oauth" }
`;

    testProject = await setupTestProject({
      '.ruler/ruler.toml': toml,
    });

    const { projectRoot } = testProject;
    const config = await loadUnifiedConfig({ projectRoot });

    const fieldConflictError = config.diagnostics.find(
      (d: any) => d.code === 'MCP_TOML_FIELD_CONFLICT',
    );
    expect(fieldConflictError).toBeTruthy();
    expect(fieldConflictError!.severity).toBe('warning');
    expect(fieldConflictError!.message).toContain('headers');
    expect(config.mcp!.servers.invalid).toEqual({
      command: 'node',
      args: ['server.js'],
      type: 'stdio',
    });
  });

  it('handles env with url (validation error)', async () => {
    const toml = `[mcp]
enabled = true

[mcp_servers.invalid]
url = "https://example.com"
env = { API_KEY = "secret" }
`;

    testProject = await setupTestProject({
      '.ruler/ruler.toml': toml,
    });

    const { projectRoot } = testProject;
    const config = await loadUnifiedConfig({ projectRoot });

    const fieldConflictError = config.diagnostics.find(
      (d: any) => d.code === 'MCP_TOML_FIELD_CONFLICT',
    );
    expect(fieldConflictError).toBeTruthy();
    expect(fieldConflictError!.severity).toBe('warning');
    expect(fieldConflictError!.message).toContain('env');
  });

  it('normalizes remote servers by removing stdio-only fields after diagnostics', async () => {
    const toml = `[mcp]
enabled = true

[mcp_servers.invalid]
url = "https://example.com"
args = ["server.js"]
env = { API_KEY = "secret" }
headers = { Authorization = "Bearer token" }
`;

    testProject = await setupTestProject({
      '.ruler/ruler.toml': toml,
    });

    const { projectRoot } = testProject;
    const config = await loadUnifiedConfig({ projectRoot });

    const fieldConflictError = config.diagnostics.find(
      (d: any) => d.code === 'MCP_TOML_FIELD_CONFLICT',
    );
    expect(fieldConflictError).toBeTruthy();
    expect(fieldConflictError!.severity).toBe('warning');
    expect(fieldConflictError!.message).toContain('env');
    expect(config.mcp!.servers.invalid).toEqual({
      url: 'https://example.com',
      headers: { Authorization: 'Bearer token' },
      type: 'remote',
    });
  });

  it('handles server with neither command nor url', async () => {
    const toml = `[mcp]
enabled = true

[mcp_servers.invalid]
args = ["some", "args"]
`;

    testProject = await setupTestProject({
      '.ruler/ruler.toml': toml,
    });

    const { projectRoot } = testProject;
    const config = await loadUnifiedConfig({ projectRoot });

    const invalidServerError = config.diagnostics.find(
      (d: any) => d.code === 'MCP_TOML_INVALID_SERVER',
    );
    expect(invalidServerError).toBeTruthy();
    expect(invalidServerError!.severity).toBe('warning');
    expect(invalidServerError!.message).toContain(
      'must have at least one of command or url',
    );
  });

  it('diagnoses legacy JSON server with both command and url', async () => {
    testProject = await setupTestProject({
      '.ruler/mcp.json': JSON.stringify(
        {
          mcpServers: {
            invalid: {
              command: 'node',
              url: 'https://example.com',
            },
          },
        },
        null,
        2,
      ),
    });

    const { projectRoot } = testProject;
    const config = await loadUnifiedConfig({ projectRoot });

    const fieldConflictError = config.diagnostics.find(
      (d: any) => d.code === 'MCP_JSON_FIELD_CONFLICT',
    );
    expect(fieldConflictError).toBeTruthy();
    expect(fieldConflictError!.severity).toBe('warning');
    expect(fieldConflictError!.message).toContain('both command and url');
    expect(config.mcp!.servers.invalid).toEqual({
      url: 'https://example.com',
      type: 'remote',
    });
  });

  it('normalizes legacy JSON servers by transport after diagnostics', async () => {
    testProject = await setupTestProject({
      '.ruler/mcp.json': JSON.stringify(
        {
          mcpServers: {
            stdio_invalid: {
              command: 'node',
              args: ['server.js'],
              headers: { Authorization: 'Bearer token' },
              auth: { token: 'remote-auth' },
              oauth: { clientId: 'remote-oauth' },
            },
            remote_invalid: {
              url: 'https://example.com',
              args: ['server.js'],
              env: { API_KEY: 'secret' },
              headers: { Authorization: 'Bearer token' },
            },
          },
        },
        null,
        2,
      ),
    });

    const { projectRoot } = testProject;
    const config = await loadUnifiedConfig({ projectRoot });

    expect(
      config.diagnostics.filter(
        (d: any) => d.code === 'MCP_JSON_FIELD_CONFLICT',
      ),
    ).toHaveLength(2);
    expect(config.mcp!.servers.stdio_invalid).toEqual({
      command: 'node',
      args: ['server.js'],
      type: 'stdio',
    });
    expect(config.mcp!.servers.remote_invalid).toEqual({
      url: 'https://example.com',
      headers: { Authorization: 'Bearer token' },
      type: 'remote',
    });
  });

  it('writes generated MCP config without transport-incompatible fields', async () => {
    const toml = `[mcp]
enabled = true

[mcp_servers.stdio_invalid]
command = "node"
args = ["server.js"]
headers = { Authorization = "Bearer token" }
auth = { token = "remote-auth" }
oauth = { clientId = "remote-oauth" }

[mcp_servers.remote_invalid]
url = "https://example.com"
args = ["server.js"]
env = { API_KEY = "secret" }
headers = { Authorization = "Bearer token" }
`;

    testProject = await setupTestProject({
      '.ruler/AGENTS.md': '# Rules',
      '.ruler/ruler.toml': toml,
    });

    const { projectRoot } = testProject;
    runRuler('apply --agents cursor --no-backup --no-gitignore', projectRoot);

    const cursorMcp = JSON.parse(
      await fs.readFile(path.join(projectRoot, '.cursor', 'mcp.json'), 'utf8'),
    );
    expect(cursorMcp.mcpServers.stdio_invalid).toEqual({
      command: 'node',
      args: ['server.js'],
      type: 'stdio',
    });
    expect(cursorMcp.mcpServers.remote_invalid).toEqual({
      url: 'https://example.com',
      headers: { Authorization: 'Bearer token' },
      type: 'remote',
    });
  });

  it('diagnoses and skips legacy JSON server with neither command nor url', async () => {
    testProject = await setupTestProject({
      '.ruler/mcp.json': JSON.stringify(
        {
          mcpServers: {
            invalid: {
              args: ['some', 'args'],
            },
          },
        },
        null,
        2,
      ),
    });

    const { projectRoot } = testProject;
    const config = await loadUnifiedConfig({ projectRoot });

    const invalidServerError = config.diagnostics.find(
      (d: any) => d.code === 'MCP_JSON_INVALID_SERVER',
    );
    expect(invalidServerError).toBeTruthy();
    expect(invalidServerError!.severity).toBe('warning');
    expect(invalidServerError!.message).toContain(
      'must have at least one of command or url',
    );
    expect(config.mcp!.servers).toEqual({});
  });
});
