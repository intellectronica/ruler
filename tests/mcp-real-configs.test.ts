// Comprehensive test to validate MCP propagation uses actual configs, not examples
import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { applyAllAgentConfigs } from '../src/lib';

describe('MCP Propagation Integration - Real vs Example Configs', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-real-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should propagate actual TOML configurations, never example configs', async () => {
    // Create .ruler directory with custom MCP servers
    const rulerDir = path.join(tmpDir, '.ruler');
    await fs.mkdir(rulerDir);

    // Create AGENTS.md 
    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), '# Test instructions');

    // Create ruler.toml with REAL, user-defined MCP servers (not examples)
    const tomlContent = `
[mcp_servers.user_real_filesystem]
command = "npx"
args = ["-y", "real-filesystem-server", "--custom-flag"]

[mcp_servers.user_real_api]  
command = "uvx"
args = ["real-api-server"]
env = { API_TOKEN = "real-token-12345" }
`;
    await fs.writeFile(path.join(rulerDir, 'ruler.toml'), tomlContent);

    // Apply ruler configuration for OpenHands
    await applyAllAgentConfigs(
      tmpDir,
      ['openhands'],
      undefined,
      true, // mcp enabled
      undefined,
      undefined,
      false, // verbose
      false, // dry run
      true   // local only
    );

    // Verify OpenHands config exists and contains ONLY the user-defined servers
    const openHandsConfigPath = path.join(tmpDir, 'config.toml');
    const configExists = await fs.access(openHandsConfigPath).then(() => true).catch(() => false);
    expect(configExists).toBe(true);

    const configContent = await fs.readFile(openHandsConfigPath, 'utf8');
    
    // Should contain the REAL user-defined servers
    expect(configContent).toContain('user_real_filesystem');
    expect(configContent).toContain('user_real_api');
    expect(configContent).toContain('real-filesystem-server');
    expect(configContent).toContain('real-api-server');
    expect(configContent).toContain('API_TOKEN = "real-token-12345"');

    // Should NOT contain any example server names or commands
    expect(configContent).not.toContain('example_stdio');
    expect(configContent).not.toContain('example_remote');
    expect(configContent).not.toContain('filesystem_server'); // from integration test
    expect(configContent).not.toContain('remote_api'); // from integration test
    expect(configContent).not.toContain('scripts/your-mcp-server.js');
    expect(configContent).not.toContain('api.example.com');
  });

  it('should merge TOML and JSON sources correctly, not use examples', async () => {
    // Create .ruler directory
    const rulerDir = path.join(tmpDir, '.ruler');
    await fs.mkdir(rulerDir);

    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), '# Test instructions');

    // Create ruler.toml with one server
    const tomlContent = `
[mcp_servers.toml_server]
command = "npx"
args = ["toml-mcp-tool"]
`;
    await fs.writeFile(path.join(rulerDir, 'ruler.toml'), tomlContent);

    // Create legacy mcp.json with another server
    const mcpJson = {
      mcpServers: {
        json_server: {
          command: "uvx", 
          args: ["json-mcp-tool"]
        }
      }
    };
    await fs.writeFile(path.join(rulerDir, 'mcp.json'), JSON.stringify(mcpJson));

    // Apply ruler configuration for OpenHands
    await applyAllAgentConfigs(
      tmpDir,
      ['openhands'],
      undefined,
      true, // mcp enabled
      undefined,
      undefined,
      false, // verbose
      false, // dry run
      true   // local only
    );

    const openHandsConfigPath = path.join(tmpDir, 'config.toml');
    const configContent = await fs.readFile(openHandsConfigPath, 'utf8');
    
    // Should contain BOTH user-defined servers from merged sources
    expect(configContent).toContain('toml_server');
    expect(configContent).toContain('json_server');
    expect(configContent).toContain('toml-mcp-tool');
    expect(configContent).toContain('json-mcp-tool');

    // Should NOT contain example configs
    expect(configContent).not.toContain('example');
    expect(configContent).not.toContain('filesystem_server');
    expect(configContent).not.toContain('remote_api');
  });

  it('should create no OpenHands config when no MCP servers are defined', async () => {
    // Create .ruler directory with NO MCP servers
    const rulerDir = path.join(tmpDir, '.ruler');
    await fs.mkdir(rulerDir);

    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), '# Test instructions');

    // ruler.toml with NO mcp_servers section
    const tomlContent = `
# No MCP servers defined at all
default_agents = ["openhands"]
`;
    await fs.writeFile(path.join(rulerDir, 'ruler.toml'), tomlContent);

    // Apply ruler configuration for OpenHands
    await applyAllAgentConfigs(
      tmpDir,
      ['openhands'],
      undefined,
      true, // mcp enabled
      undefined,
      undefined,
      false, // verbose
      false, // dry run
      true   // local only
    );

    // Should NOT create OpenHands config file when no servers are defined
    const openHandsConfigPath = path.join(tmpDir, 'config.toml');
    const configExists = await fs.access(openHandsConfigPath).then(() => true).catch(() => false);
    expect(configExists).toBe(false);
  });
});