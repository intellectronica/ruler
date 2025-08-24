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

  it('should skip local servers and only configure remote servers', async () => {
    const rulerMcp = {
      mcpServers: { 
        localServer: { command: 'uvx', args: ['mcp-fetch'] },
        remoteServer: { url: 'https://api.example.com/mcp' }
      },
    };

    await fs.writeFile(rulerMcpPath, JSON.stringify(rulerMcp));

    await propagateMcpToOpenHands(rulerMcpPath, openHandsConfigPath);

    const content = await fs.readFile(openHandsConfigPath, 'utf8');
    const parsed = TOML.parse(content);
    expect(parsed.mcp).toBeDefined();
    const mcp: any = parsed.mcp;
    
    // Should have remote servers only
    expect(mcp.servers).toBeDefined();
    expect(mcp.servers.remoteServer).toEqual({ url: 'https://api.example.com/mcp' });
    expect(mcp.servers.localServer).toBeUndefined(); // Local server should be skipped
    
    // Should not have stdio_servers section at all
    expect(mcp.stdio_servers).toBeUndefined();
  });

  it('should merge remote servers into an existing config.toml', async () => {
    const rulerMcp = {
      mcpServers: { 
        api: { url: 'https://api.ruler.com/mcp' }
      },
    };

    await fs.writeFile(rulerMcpPath, JSON.stringify(rulerMcp));
    const existingToml = `
[mcp.servers]
  [mcp.servers.github]
    url = "https://api.github.com/mcp"
    `;
    await fs.writeFile(openHandsConfigPath, existingToml);

    await propagateMcpToOpenHands(rulerMcpPath, openHandsConfigPath);

    const content = await fs.readFile(openHandsConfigPath, 'utf8');
    const parsed = TOML.parse(content);
    const mcp: any = parsed.mcp;
    expect(Object.keys(mcp.servers)).toHaveLength(2);
    expect(mcp.servers.github).toEqual({ url: 'https://api.github.com/mcp' });
    expect(mcp.servers.api).toEqual({ url: 'https://api.ruler.com/mcp' });
  });

  it('should overwrite existing servers with same name', async () => {
    const rulerMcp = {
      mcpServers: { 
        api: { url: 'https://api.new.com/mcp' }
      },
    };

    await fs.writeFile(rulerMcpPath, JSON.stringify(rulerMcp));
    const existingToml = `
[mcp.servers]
  [mcp.servers.api]
    url = "https://api.old.com/mcp"
    `;
    await fs.writeFile(openHandsConfigPath, existingToml);

    await propagateMcpToOpenHands(rulerMcpPath, openHandsConfigPath);

    const content = await fs.readFile(openHandsConfigPath, 'utf8');
    const parsed = TOML.parse(content);
    const mcp: any = parsed.mcp;
    expect(Object.keys(mcp.servers)).toHaveLength(1);
    expect(mcp.servers.api).toEqual({ url: 'https://api.new.com/mcp' });
  });

  it('should handle only remote servers and skip all local servers', async () => {
    const rulerMcp = {
      mcpServers: {
        // All local servers should be skipped
        fs: { command: 'npx', args: ['mcp-fs'] },
        git: { command: 'uvx', args: ['mcp-git'] },
        // Only remote servers should be included
        api: { url: 'https://api.example.com/mcp' },
      },
    };
    await fs.writeFile(rulerMcpPath, JSON.stringify(rulerMcp));

    await propagateMcpToOpenHands(rulerMcpPath, openHandsConfigPath);

    const content = await fs.readFile(openHandsConfigPath, 'utf8');
    const parsed: any = TOML.parse(content);
    expect(parsed.mcp.servers).toBeDefined();
    expect(Object.keys(parsed.mcp.servers)).toHaveLength(1);
    expect(parsed.mcp.servers.api).toEqual({ url: 'https://api.example.com/mcp' });
    expect(parsed.mcp.servers.fs).toBeUndefined();
    expect(parsed.mcp.servers.git).toBeUndefined();
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
    // No servers should have been added since none are valid remote servers
    expect(Object.keys(mcp.servers || {})).toHaveLength(0);
  });
});
