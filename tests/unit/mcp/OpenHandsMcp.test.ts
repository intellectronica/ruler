import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { parse as parseTOML } from '@iarna/toml';
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
    const parsed = parseTOML(content);
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
    const parsed = parseTOML(content);
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
    const parsed = parseTOML(content);
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
    const parsedWithEnv: any = parseTOML(contentWithEnv);
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
    const parsed = parseTOML(content);
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

  it('should propagate remote servers to shttp_servers by default', async () => {
    const rulerMcp = {
      mcpServers: { 
        api: { url: 'https://api.example.com/mcp' },
        search: { url: 'https://search.example.com' }
      },
    };

    await propagateMcpToOpenHands(rulerMcp, openHandsConfigPath);

    const content = await fs.readFile(openHandsConfigPath, 'utf8');
    const parsed = parseTOML(content);
    const mcp: any = parsed.mcp;
    
    expect(mcp.shttp_servers).toHaveLength(2);
    expect(mcp.shttp_servers).toContain('https://api.example.com/mcp');
    expect(mcp.shttp_servers).toContain('https://search.example.com');
    expect(mcp.sse_servers).toHaveLength(0);
  });

  it('should classify URLs with /sse path as sse_servers', async () => {
    const rulerMcp = {
      mcpServers: { 
        sse_api: { url: 'https://api.example.com/sse/mcp' },
        realtime: { url: 'https://realtime.example.com/mcp/sse' }
      },
    };

    await propagateMcpToOpenHands(rulerMcp, openHandsConfigPath);

    const content = await fs.readFile(openHandsConfigPath, 'utf8');
    const parsed = parseTOML(content);
    const mcp: any = parsed.mcp;
    
    expect(mcp.sse_servers).toHaveLength(2);
    expect(mcp.sse_servers).toContain('https://api.example.com/sse/mcp');
    expect(mcp.sse_servers).toContain('https://realtime.example.com/mcp/sse');
    expect(mcp.shttp_servers).toHaveLength(0);
  });

  it('should extract api_key from Authorization Bearer header when it is the only header', async () => {
    const rulerMcp = {
      mcpServers: { 
        auth_api: { 
          url: 'https://secure.example.com/mcp',
          headers: { Authorization: 'Bearer secret-token-123' }
        }
      },
    };

    await propagateMcpToOpenHands(rulerMcp, openHandsConfigPath);

    const content = await fs.readFile(openHandsConfigPath, 'utf8');
    const parsed = parseTOML(content);
    const mcp: any = parsed.mcp;
    
    expect(mcp.shttp_servers).toHaveLength(1);
    expect(mcp.shttp_servers[0]).toEqual({
      url: 'https://secure.example.com/mcp',
      api_key: 'secret-token-123'
    });
  });

  it('should fallback to simple URL when headers contain non-auth headers', async () => {
    const rulerMcp = {
      mcpServers: { 
        complex_api: { 
          url: 'https://complex.example.com/mcp',
          headers: { 
            Authorization: 'Bearer token-123',
            'X-Custom-Header': 'custom-value',
            'X-Another': 'another-value'
          }
        }
      },
    };

    await propagateMcpToOpenHands(rulerMcp, openHandsConfigPath);

    const content = await fs.readFile(openHandsConfigPath, 'utf8');
    const parsed = parseTOML(content);
    const mcp: any = parsed.mcp;
    
    expect(mcp.shttp_servers).toHaveLength(1);
    // Should be simple URL string (no api_key extraction due to extra headers)
    expect(mcp.shttp_servers[0]).toBe('https://complex.example.com/mcp');
  });

  it('should merge remote servers with existing OpenHands config', async () => {
    const rulerMcp = {
      mcpServers: { 
        new_api: { url: 'https://new.example.com/mcp' }
      },
    };

    const existingToml = `
[[mcp.shttp_servers]]
url = "https://existing.example.com"

[[mcp.sse_servers]]
url = "https://existing-sse.example.com/sse"

[[mcp.stdio_servers]]
name = "fs"
command = "npx"
args = ["mcp-fs"]
    `;
    await fs.writeFile(openHandsConfigPath, existingToml);

    await propagateMcpToOpenHands(rulerMcp, openHandsConfigPath);

    const content = await fs.readFile(openHandsConfigPath, 'utf8');
    const parsed = parseTOML(content);
    const mcp: any = parsed.mcp;
    
    expect(mcp.shttp_servers).toHaveLength(2);
    expect(mcp.shttp_servers).toContainEqual({ url: 'https://existing.example.com' });
    expect(mcp.shttp_servers).toContainEqual({ url: 'https://new.example.com/mcp' });
    
    expect(mcp.sse_servers).toHaveLength(1);
    expect(mcp.sse_servers).toContainEqual({ url: 'https://existing-sse.example.com/sse' });
    
    expect(mcp.stdio_servers).toHaveLength(1);
    expect(mcp.stdio_servers[0].name).toBe('fs');
  });

  it('should handle mixed stdio and remote servers', async () => {
    const rulerMcp = {
      mcpServers: { 
        fs: { command: 'npx', args: ['mcp-fs'] },
        api: { url: 'https://api.example.com/mcp' },
        sse_service: { url: 'https://realtime.example.com/sse' }
      },
    };

    await propagateMcpToOpenHands(rulerMcp, openHandsConfigPath);

    const content = await fs.readFile(openHandsConfigPath, 'utf8');
    const parsed = parseTOML(content);
    const mcp: any = parsed.mcp;
    
    expect(mcp.stdio_servers).toHaveLength(1);
    expect(mcp.stdio_servers[0]).toEqual({
      name: 'fs',
      command: 'npx',
      args: ['mcp-fs']
    });
    
    expect(mcp.shttp_servers).toHaveLength(1);
    expect(mcp.shttp_servers[0]).toBe('https://api.example.com/mcp');
    
    expect(mcp.sse_servers).toHaveLength(1);
    expect(mcp.sse_servers[0]).toBe('https://realtime.example.com/sse');
  });

  it('should overwrite remote servers with same URL', async () => {
    const rulerMcp = {
      mcpServers: { 
        updated_api: { 
          url: 'https://api.example.com/mcp',
          headers: { Authorization: 'Bearer new-token' }
        }
      },
    };

    const existingToml = `
[[mcp.shttp_servers]]
url = "https://api.example.com/mcp"
    `;
    await fs.writeFile(openHandsConfigPath, existingToml);

    await propagateMcpToOpenHands(rulerMcp, openHandsConfigPath);

    const content = await fs.readFile(openHandsConfigPath, 'utf8');
    const parsed = parseTOML(content);
    const mcp: any = parsed.mcp;
    
    expect(mcp.shttp_servers).toHaveLength(1);
    // Should be updated with api_key object
    expect(mcp.shttp_servers[0]).toEqual({
      url: 'https://api.example.com/mcp',
      api_key: 'new-token'
    });
  });
});
