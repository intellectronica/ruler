import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CodexCliAgent } from '../../../src/agents/CodexCliAgent';

describe('CodexCliAgent - MCP Config Path Tracking', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-codex-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should return both instructions and config paths from getDefaultOutputPath', () => {
    const agent = new CodexCliAgent();
    const result = agent.getDefaultOutputPath(tmpDir);
    
    expect(result).toEqual({
      instructions: path.join(tmpDir, 'AGENTS.md'),
      config: path.join(tmpDir, '.codex', 'config.toml'),
    });
  });

  it('should create both AGENTS.md and .codex/config.toml when MCP is enabled', async () => {
    const agent = new CodexCliAgent();
    const rulerMcpJson = {
      mcpServers: {
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/files']
        }
      }
    };
    
    await agent.applyRulerConfig(
      '# Test Rules\nThis is a test configuration.',
      tmpDir,
      rulerMcpJson
    );
    
    // Check that both files were created
    const agentsPath = path.join(tmpDir, 'AGENTS.md');
    const configPath = path.join(tmpDir, '.codex', 'config.toml');
    
    expect(await fs.access(agentsPath).then(() => true).catch(() => false)).toBe(true);
    expect(await fs.access(configPath).then(() => true).catch(() => false)).toBe(true);
    
    // Verify content
    const agentsContent = await fs.readFile(agentsPath, 'utf8');
    expect(agentsContent).toContain('Test Rules');
    
    const configContent = await fs.readFile(configPath, 'utf8');
    expect(configContent).toContain('[mcp_servers.filesystem]');
    expect(configContent).toContain('command = "npx"');
  });

  it('should respect outputPathConfig override', async () => {
    const agent = new CodexCliAgent();
    const customConfigPath = path.join(tmpDir, 'custom', 'codex.toml');
    const rulerMcpJson = {
      mcpServers: {
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/files']
        }
      }
    };
    
    await agent.applyRulerConfig(
      '# Test Rules',
      tmpDir,
      rulerMcpJson,
      { outputPathConfig: customConfigPath }
    );
    
    // Should create config at custom path
    expect(await fs.access(customConfigPath).then(() => true).catch(() => false)).toBe(true);
    
    // Should still create AGENTS.md at default location
    const agentsPath = path.join(tmpDir, 'AGENTS.md');
    expect(await fs.access(agentsPath).then(() => true).catch(() => false)).toBe(true);
  });
});