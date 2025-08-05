import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import toml from 'toml';

import { CodexCliAgent } from '../../../src/agents/CodexCliAgent';

describe('CodexCliAgent MCP Handling', () => {
  let tmpDir: string;
  let mcpJson: Record<string, any>;
  
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-codex-'));
    // Create MCP JSON object with ruler_server definition
    mcpJson = { 
      mcpServers: { 
        ruler_server: { 
          command: 'npx',
          args: ['-y', 'ruler-mcp'],
          env: { API_KEY: 'test-key' }
        } 
      } 
    };
  });
  
  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('merges servers when strategy is merge', async () => {
    const agent = new CodexCliAgent();
    // Pre-existing config with native_server
    const configPath = path.join(tmpDir, '.codex', 'config.toml');
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    const initialToml = [];
    initialToml.push('[mcp_servers.native_server]');
    initialToml.push('command = "npx"');
    initialToml.push('args = ["-y", "native-mcp"]');
    initialToml.push('env = { API_KEY = "native-key" }');
    await fs.writeFile(configPath, initialToml.join('\n') + '\n');

    await agent.applyRulerConfig('', tmpDir, mcpJson, { mcp: { enabled: true, strategy: 'merge' } });
    
    const resultStr = await fs.readFile(configPath, 'utf8');
    const result = toml.parse(resultStr) as Record<string, any>;
    
    // Check native server is preserved
    expect(result.mcp_servers.native_server.command).toBe('npx');
    expect(result.mcp_servers.native_server.args).toEqual(['-y', 'native-mcp']);
    expect(result.mcp_servers.native_server.env.API_KEY).toBe('native-key');
    
    // Check ruler server was added
    expect(result.mcp_servers.ruler_server.command).toBe('npx');
    expect(result.mcp_servers.ruler_server.args).toEqual(['-y', 'ruler-mcp']);
    expect(result.mcp_servers.ruler_server.env.API_KEY).toBe('test-key');
  });

  it('overwrites servers when strategy is overwrite', async () => {
    const agent = new CodexCliAgent();
    const configPath = path.join(tmpDir, '.codex', 'config.toml');
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    const initialToml = [
      '[mcp_servers.native_server]', 
      'command = "npx"',
      'args = ["-y", "native-mcp"]',
      'env = { API_KEY = "native-key" }'
    ];
    await fs.writeFile(configPath, initialToml.join('\n') + '\n');

    await agent.applyRulerConfig('', tmpDir, mcpJson, { mcp: { enabled: true, strategy: 'overwrite' } });
    
    const resultStr = await fs.readFile(configPath, 'utf8');
    const result = toml.parse(resultStr) as Record<string, any>;
    
    expect(result.mcp_servers).not.toHaveProperty('native_server');
    expect(result.mcp_servers.ruler_server.command).toBe('npx');
    expect(result.mcp_servers.ruler_server.args).toEqual(['-y', 'ruler-mcp']);
    expect(result.mcp_servers.ruler_server.env.API_KEY).toBe('test-key');
  });

  it('creates config.toml at custom path', async () => {
    const agent = new CodexCliAgent();
    const custom = path.join(tmpDir, 'custom', 'codex.toml');
    
    // Create the parent directory first
    await fs.mkdir(path.dirname(custom), { recursive: true });
    
    // Apply the configuration with a custom path
    await agent.applyRulerConfig('', tmpDir, mcpJson, { 
      mcp: { enabled: true }, 
      outputPathConfig: custom 
    });
    
    // Verify the file was created
    const exists = await fs.stat(custom);
    expect(exists.isFile()).toBe(true);
    
    // Verify the content
    const content = await fs.readFile(custom, 'utf8');
    const parsed = toml.parse(content);
    expect(parsed.mcp_servers).toHaveProperty('ruler_server');
    expect(parsed.mcp_servers.ruler_server.command).toBe('npx');
    expect(parsed.mcp_servers.ruler_server.args).toEqual(['-y', 'ruler-mcp']);
    expect(parsed.mcp_servers.ruler_server.env.API_KEY).toBe('test-key');
  });

  it('still writes instructions file alongside config', async () => {
    const agent = new CodexCliAgent();
    const instructionsPath = path.join(tmpDir, 'AGENTS.md');
    await agent.applyRulerConfig('instructions', tmpDir, null, { mcp: { enabled: false } });
    const content = await fs.readFile(instructionsPath, 'utf8');
    expect(content).toBe('instructions');
  });
});