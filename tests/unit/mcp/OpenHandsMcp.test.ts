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

    await fs.writeFile(rulerMcpPath, JSON.stringify(rulerMcp));

    await propagateMcpToOpenHands(rulerMcpPath, openHandsConfigPath);

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

    await fs.writeFile(rulerMcpPath, JSON.stringify(rulerMcp));
    const existingToml = `
[mcp]
stdio_servers = [
  { name = "fs", command = "npx", args = ["mcp-fs"] }
]
    `;
    await fs.writeFile(openHandsConfigPath, existingToml);

    await propagateMcpToOpenHands(rulerMcpPath, openHandsConfigPath);

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

    await fs.writeFile(rulerMcpPath, JSON.stringify(rulerMcp));
    const existingToml = `
[mcp]
stdio_servers = [
  { name = "fs", command = "npx", args = ["mcp-fs-old"] }
]
    `;
    await fs.writeFile(openHandsConfigPath, existingToml);

    await propagateMcpToOpenHands(rulerMcpPath, openHandsConfigPath);

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
    await fs.writeFile(rulerMcpPath, JSON.stringify(rulerMcp));

    await propagateMcpToOpenHands(rulerMcpPath, openHandsConfigPath);

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

    await fs.writeFile(rulerMcpPath, JSON.stringify(rulerMcp));

    await propagateMcpToOpenHands(rulerMcpPath, openHandsConfigPath);

    const content = await fs.readFile(openHandsConfigPath, 'utf8');
    const parsed = TOML.parse(content);
    expect(parsed.mcp).toBeDefined();
    const mcp: any = parsed.mcp;
    // No servers should have been added
    expect(mcp.stdio_servers).toHaveLength(0);
  });
});
