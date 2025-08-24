import * as fs from 'fs/promises';
import * as path from 'path';
import { setupTestProject, teardownTestProject, runRuler } from './harness';

describe('unified-config.mcp-toml-load', () => {
  let testProject: { projectRoot: string };

  beforeEach(async () => {
    const toml = `[mcp]
enabled = true
merge_strategy = "merge"

[mcp_servers.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/project"]

[mcp_servers.remote_api]
url = "https://api.example.com"
headers = { Authorization = "Bearer secret" }
`;

    const mcpJson = {
      mcpServers: {
        git: {
          command: 'uvx',
          args: ['mcp-git']
        }
      }
    };

    testProject = await setupTestProject({
      '.ruler/ruler.toml': toml,
      '.ruler/mcp.json': JSON.stringify(mcpJson, null, 2)
    });
  });

  afterEach(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('loads unified config with merged TOML and JSON MCP servers', async () => {
    const { projectRoot } = testProject;
    
    // Import the loadUnifiedConfig function
    const { loadUnifiedConfig } = require('../dist/core/UnifiedConfigLoader');
    
    const config = await loadUnifiedConfig({ projectRoot });
    
    // Should have merged servers from both TOML and JSON
    expect(config.mcp).toBeTruthy();
    expect(config.mcp.servers).toHaveProperty('filesystem');
    expect(config.mcp.servers.filesystem).toEqual({
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/project']
    });
    
    expect(config.mcp.servers).toHaveProperty('remote_api');
    expect(config.mcp.servers.remote_api).toEqual({
      type: 'remote',
      url: 'https://api.example.com',
      headers: { Authorization: 'Bearer secret' }
    });
    
    expect(config.mcp.servers).toHaveProperty('git');
    expect(config.mcp.servers.git).toEqual({
      type: 'stdio',
      command: 'uvx',
      args: ['mcp-git']
    });
  });

  it('includes deprecation warning when mcp.json exists', async () => {
    const { projectRoot } = testProject;
    
    const { loadUnifiedConfig } = require('../dist/core/UnifiedConfigLoader');
    const config = await loadUnifiedConfig({ projectRoot });
    
    const deprecationWarning = config.diagnostics.find((d: any) => 
      d.code === 'MCP_JSON_DEPRECATED'
    );
    expect(deprecationWarning).toBeTruthy();
    expect(deprecationWarning.severity).toBe('warning');
    expect(deprecationWarning.message).toContain('mcp.json');
  });
});