import * as fs from 'fs/promises';
import * as path from 'path';
import { setupTestProject, teardownTestProject, runRulerWithInheritedStdio } from './harness';

describe('claude-http-type', () => {
  let testProject: { projectRoot: string };

  beforeEach(async () => {
    // Create a test project with MCP servers in TOML format
    const rulerToml = `
[mcp_servers.grep]
url = "https://mcp.grep.app"

[mcp_servers.local_server]
command = "npx"
args = ["mcp-fs", "/tmp"]
`;

    testProject = await setupTestProject({
      '.ruler/ruler.toml': rulerToml,
    });
  });

  afterEach(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('should output type "http" for URL-based servers in Claude config', async () => {
    const { projectRoot } = testProject;
    
    runRulerWithInheritedStdio('apply --agents claude', projectRoot);

    // Verify Claude MCP config uses 'http' type for URL-based servers
    const claudeResultText = await fs.readFile(
      path.join(projectRoot, '.mcp.json'),
      'utf8',
    );
    const claudeResult = JSON.parse(claudeResultText);
    
    // Should have 'mcpServers' key
    expect(claudeResult.mcpServers).toBeDefined();
    
    // URL-based server should have type 'http', not 'remote'
    expect(claudeResult.mcpServers.grep).toBeDefined();
    expect(claudeResult.mcpServers.grep.type).toBe('http');
    expect(claudeResult.mcpServers.grep.url).toBe('https://mcp.grep.app');
    
    // Command-based server should still have type 'stdio'
    expect(claudeResult.mcpServers.local_server).toBeDefined();
    expect(claudeResult.mcpServers.local_server.type).toBe('stdio');
  });

  it('should output type "sse" for SSE-based servers in Claude config', async () => {
    const { projectRoot } = testProject;
    
    // Create a TOML with SSE server
    const rulerTomlWithSse = `
[mcp_servers.linear]
url = "https://mcp.linear.app/sse"
`;

    await fs.writeFile(
      path.join(projectRoot, '.ruler/ruler.toml'), 
      rulerTomlWithSse
    );
    
    runRulerWithInheritedStdio('apply --agents claude', projectRoot);

    // Verify Claude MCP config uses 'sse' type for SSE-based servers  
    const claudeResultText = await fs.readFile(
      path.join(projectRoot, '.mcp.json'),
      'utf8',
    );
    const claudeResult = JSON.parse(claudeResultText);
    
    // SSE server should have type 'sse'
    expect(claudeResult.mcpServers.linear).toBeDefined();
    expect(claudeResult.mcpServers.linear.type).toBe('sse');
    expect(claudeResult.mcpServers.linear.url).toBe('https://mcp.linear.app/sse');
  });

  it('should maintain correct structure and transformations when running for all agents', async () => {
    const { projectRoot } = testProject;
    
    // Run for ALL agents (not just Claude)
    runRulerWithInheritedStdio('apply', projectRoot);

    // Verify Claude MCP config has correct structure and transformations
    const claudeResultText = await fs.readFile(
      path.join(projectRoot, '.mcp.json'),
      'utf8',
    );
    const claudeResult = JSON.parse(claudeResultText);
    
    // Should have 'mcpServers' key, not empty string ""
    expect(claudeResult.mcpServers).toBeDefined();
    expect(claudeResult['']).toBeUndefined();
    
    // URL-based server should have transformed type 'http', not 'remote'
    expect(claudeResult.mcpServers.grep).toBeDefined();
    expect(claudeResult.mcpServers.grep.type).toBe('http');
    expect(claudeResult.mcpServers.grep.url).toBe('https://mcp.grep.app');
    
    // Command-based server should still have type 'stdio'
    expect(claudeResult.mcpServers.local_server).toBeDefined();
    expect(claudeResult.mcpServers.local_server.type).toBe('stdio');
  });
});