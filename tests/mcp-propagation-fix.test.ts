// Test to validate that MCP propagation uses merged config data instead of legacy file
import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { propagateMcpToOpenHands } from '../src/mcp/propagateOpenHandsMcp';
import { propagateMcpToOpenCode } from '../src/mcp/propagateOpenCodeMcp';

describe('MCP Propagation with Merged Config', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-propagation-fix-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('propagateMcpToOpenHands should use provided data instead of reading from file', async () => {
    const openHandsConfigPath = path.join(tmpDir, 'config.toml');

    // Simulate merged configuration data that would come from unified config loader
    const mergedMcpData = {
      mcpServers: {
        'from-toml': { command: 'npx', args: ['mcp-from-toml'] },
        'from-json': { command: 'uvx', args: ['mcp-from-json'] },
      },
    };

    // Create a legacy file with different content to ensure it's NOT used
    const legacyMcpPath = path.join(tmpDir, 'mcp.json');
    const legacyData = {
      mcpServers: {
        'legacy-server': { command: 'legacy-cmd', args: ['legacy-arg'] },
      },
    };
    await fs.writeFile(legacyMcpPath, JSON.stringify(legacyData));

    // Call propagation with merged data (not the file path)
    await propagateMcpToOpenHands(mergedMcpData, openHandsConfigPath);

    // Verify that the config contains merged data, NOT the legacy data
    const content = await fs.readFile(openHandsConfigPath, 'utf8');
    const { parse } = require('@iarna/toml');
    const parsed = parse(content);

    expect(parsed.mcp.stdio_servers).toHaveLength(2);
    expect(parsed.mcp.stdio_servers).toContainEqual({
      name: 'from-toml',
      command: 'npx',
      args: ['mcp-from-toml'],
    });
    expect(parsed.mcp.stdio_servers).toContainEqual({
      name: 'from-json',
      command: 'uvx',
      args: ['mcp-from-json'],
    });

    // Ensure the legacy server is NOT included
    expect(parsed.mcp.stdio_servers).not.toContainEqual(
      expect.objectContaining({ name: 'legacy-server' })
    );
  });

  it('propagateMcpToOpenCode should consistently use provided data', async () => {
    const openCodeConfigPath = path.join(tmpDir, 'opencode.json');

    // Simulate merged configuration data
    const mergedMcpData = {
      mcpServers: {
        'from-toml': { command: 'npx', args: ['mcp-from-toml'] },
        'from-json': { url: 'https://remote-server.com' },
      },
    };

    // Call propagation with merged data
    await propagateMcpToOpenCode(mergedMcpData, openCodeConfigPath);

    // Verify the output contains the merged data
    const content = JSON.parse(await fs.readFile(openCodeConfigPath, 'utf8'));

    expect(content.$schema).toBe('https://opencode.ai/config.json');
    expect(content.mcp['from-toml']).toEqual({
      type: 'local',
      command: ['npx', 'mcp-from-toml'],
      enabled: true,
    });
    expect(content.mcp['from-json']).toEqual({
      type: 'remote',
      url: 'https://remote-server.com',
      enabled: true,
    });
  });
});