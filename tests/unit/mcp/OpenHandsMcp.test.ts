import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import * as TOML from 'toml';
import { propagateMcpToOpenHands } from '../../../src/mcp/propagateOpenHandsMcp';

describe('propagateMcpToOpenHands', () => {
  let tmpDir: string;
  let rulerMcpPath: string;
  let openHandsConfigPath: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-mcp-test-'));
    rulerMcpPath = path.join(tmpDir, 'ruler-mcp.json');
    openHandsConfigPath = path.join(tmpDir, 'config.toml');
  });
  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should create a new config.toml with stdio_servers', async () => {
    const rulerMcp = {
      mcpServers: { fetch: { command: 'uvx', args: ['mcp-fetch'] } },
    };

    await propagateMcpToOpenHands(rulerMcp, openHandsConfigPath);

    const content = await fs.readFile(openHandsConfigPath, 'utf8');
    const parsed = TOML.parse(content);
    expect(parsed.mcp).toBeDefined();
    const mcp: any = parsed.mcp;
    expect(mcp.stdio_servers).toHaveLength(1);
    expect(mcp.stdio_servers[0]).toEqual({
      name: 'fetch',
      command: 'uvx',
      args: ['mcp-fetch'],
    });
  });

  it('should merge servers into an existing config.toml', async () => {
    const rulerMcp = {
      mcpServers: { git: { command: 'npx', args: ['mcp-git'] } },
    };

    const existingToml = `
[mcp]
stdio_servers = [
  { name = "fs", command = "npx", args = ["mcp-fs"] }
]
    `;
    await fs.writeFile(openHandsConfigPath, existingToml);

    await propagateMcpToOpenHands(rulerMcp, openHandsConfigPath);

    const content = await fs.readFile(openHandsConfigPath, 'utf8');
    const parsed = TOML.parse(content);
    const mcp: any = parsed.mcp;
    expect(mcp.stdio_servers).toHaveLength(2);
    expect(mcp.stdio_servers).toContainEqual({
      name: 'fs',
      command: 'npx',
      args: ['mcp-fs'],
    });
    expect(mcp.stdio_servers).toContainEqual({
      name: 'git',
      command: 'npx',
      args: ['mcp-git'],
    });
  });

  it('should not add duplicate servers', async () => {
    const rulerMcp = {
      mcpServers: { fs: { command: 'uvx', args: ['mcp-fs-new'] } },
    };

    const existingToml = `
[mcp]
stdio_servers = [
  { name = "fs", command = "npx", args = ["mcp-fs-old"] }
]
    `;
    await fs.writeFile(openHandsConfigPath, existingToml);

    await propagateMcpToOpenHands(rulerMcp, openHandsConfigPath);

    const content = await fs.readFile(openHandsConfigPath, 'utf8');
    const parsed = TOML.parse(content);
    const mcp: any = parsed.mcp;
    expect(mcp.stdio_servers).toHaveLength(1);
    // The existing server should be overwritten by the new one from ruler
    expect(mcp.stdio_servers[0]).toEqual({
      name: 'fs',
      command: 'uvx',
      args: ['mcp-fs-new'],
    });
  });

  it('should propagate env variables for stdio servers', async () => {
    const serverEnv = { TEST_VAR: 'value', ANOTHER: '123' };
    const rulerMcp = {
      mcpServers: {
        fetch: { command: 'uvx', args: ['mcp-fetch'], env: serverEnv },
      },
    };

    await propagateMcpToOpenHands(rulerMcp, openHandsConfigPath);

    const contentWithEnv = await fs.readFile(openHandsConfigPath, 'utf8');
    const parsedWithEnv: any = TOML.parse(contentWithEnv);
    expect(parsedWithEnv.mcp.stdio_servers).toHaveLength(1);
    expect(parsedWithEnv.mcp.stdio_servers[0]).toEqual(
      expect.objectContaining({ env: serverEnv }),
    );
  });

  it('should handle malformed rulerMcp data gracefully', async () => {
    const rulerMcp = {
      mcpServers: {
        // 'command' is missing
        fetch: { args: ['mcp-fetch'] },
        // serverDef is not an object
        git: 'invalid',
        // serverDef is null
        fs: null,
      },
    };

    await propagateMcpToOpenHands(rulerMcp, openHandsConfigPath);

    const content = await fs.readFile(openHandsConfigPath, 'utf8');
    const parsed = TOML.parse(content);
    expect(parsed.mcp).toBeDefined();
    const mcp: any = parsed.mcp;
    // No servers should have been added
    expect(mcp.stdio_servers).toHaveLength(0);
  });

  it('should handle null rulerMcp data gracefully', async () => {
    await propagateMcpToOpenHands(null, openHandsConfigPath);

    // Should not create config file when data is null
    try {
      await fs.access(openHandsConfigPath);
      // If file exists, it should be empty or not contain MCP config
      fail('File should not be created when rulerMcp is null');
    } catch (error) {
      // Expected - file should not exist
    }
  });

  it('should handle empty rulerMcp data gracefully', async () => {
    const rulerMcp = {};

    await propagateMcpToOpenHands(rulerMcp, openHandsConfigPath);

    // Should not create config file when data is empty
    try {
      await fs.access(openHandsConfigPath);
      // If file exists, it should be empty or not contain MCP config
      fail('File should not be created when rulerMcp is empty');
    } catch (error) {
      // Expected - file should not exist
    }
  });
});
