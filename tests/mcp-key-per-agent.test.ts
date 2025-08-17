import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { execSync } from 'child_process';

describe('mcp-key-per-agent', () => {
  let tmpDir: string;
  let rulerDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-mcp-key-'));
    rulerDir = path.join(tmpDir, '.ruler');
    await fs.mkdir(rulerDir, { recursive: true });
    
    // Create ruler MCP config
    const rulerMcp = { mcpServers: { ruler_server: { url: 'http://ruler.com' } } };
    await fs.writeFile(
      path.join(rulerDir, 'mcp.json'),
      JSON.stringify(rulerMcp, null, 2) + '\n',
    );

    // Create .vscode directory with existing Copilot MCP config using 'servers' key
    const vscodeDir = path.join(tmpDir, '.vscode');
    await fs.mkdir(vscodeDir, { recursive: true });
    const copilotNative = { servers: { native_copilot_server: { url: 'http://copilot.com' } } };
    await fs.writeFile(
      path.join(vscodeDir, 'mcp.json'),
      JSON.stringify(copilotNative, null, 2) + '\n',
    );

    // Create .cursor directory with existing Cursor MCP config using 'mcpServers' key
    const cursorDir = path.join(tmpDir, '.cursor');
    await fs.mkdir(cursorDir, { recursive: true });
    const cursorNative = { mcpServers: { native_cursor_server: { url: 'http://cursor.com' } } };
    await fs.writeFile(
      path.join(cursorDir, 'mcp.json'),
      JSON.stringify(cursorNative, null, 2) + '\n',
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should use "servers" key for Copilot and "mcpServers" key for Cursor', async () => {
    
    execSync(`node dist/cli/index.js apply --project-root ${tmpDir} --agents copilot,cursor`, {
      stdio: 'inherit',
    });

    // Verify Copilot MCP config uses 'servers' key
    const copilotResultText = await fs.readFile(
      path.join(tmpDir, '.vscode', 'mcp.json'),
      'utf8',
    );
    const copilotResult = JSON.parse(copilotResultText);
    
    // Should have 'servers' key, not 'mcpServers'
    expect(copilotResult.servers).toBeDefined();
    expect(copilotResult.mcpServers).toBeUndefined();
    
    // Should contain both native and ruler servers
    expect(Object.keys(copilotResult.servers).sort()).toEqual(['native_copilot_server', 'ruler_server']);

    // Verify Cursor MCP config uses 'mcpServers' key
    const cursorResultText = await fs.readFile(
      path.join(tmpDir, '.cursor', 'mcp.json'),
      'utf8',
    );
    const cursorResult = JSON.parse(cursorResultText);
    
    // Should have 'mcpServers' key
    expect(cursorResult.mcpServers).toBeDefined();
    
    // Should contain both native and ruler servers
    expect(Object.keys(cursorResult.mcpServers).sort()).toEqual(['native_cursor_server', 'ruler_server']);
  });
});