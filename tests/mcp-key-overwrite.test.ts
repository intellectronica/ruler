import * as fs from 'fs/promises';
import * as path from 'path';
import {
  setupTestProject,
  teardownTestProject,
  runRulerWithInheritedStdio,
} from './harness';

describe('mcp-key-overwrite', () => {
  let testProject: { projectRoot: string };

  beforeEach(async () => {
    // Create ruler MCP config
    const rulerMcp = {
      mcpServers: { ruler_server: { url: 'http://ruler.com' } },
    };

    // Create shared MCP config using 'mcpServers' key (copilot now uses .mcp.json)
    const sharedNative = {
      mcpServers: { native_copilot_server: { url: 'http://copilot.com' } },
    };

    // Create Cursor MCP config using 'mcpServers' key
    const cursorNative = {
      mcpServers: { native_cursor_server: { url: 'http://cursor.com' } },
    };

    testProject = await setupTestProject({
      '.ruler/mcp.json': JSON.stringify(rulerMcp, null, 2) + '\n',
      '.mcp.json': JSON.stringify(sharedNative, null, 2) + '\n',
      '.cursor/mcp.json': JSON.stringify(cursorNative, null, 2) + '\n',
    });
  });

  afterEach(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('should overwrite with correct keys for different agents', async () => {
    const { projectRoot } = testProject;

    runRulerWithInheritedStdio(
      'apply --agents copilot,cursor --mcp-overwrite',
      projectRoot,
    );

    // Verify Copilot MCP config was overwritten and uses 'mcpServers' key
    const copilotResultText = await fs.readFile(
      path.join(projectRoot, '.mcp.json'),
      'utf8',
    );
    const copilotResult = JSON.parse(copilotResultText);

    // Should have 'mcpServers' key, not 'servers'
    expect(copilotResult.mcpServers).toBeDefined();
    expect(copilotResult.servers).toBeUndefined();

    // Should contain only ruler server (overwrite should remove native)
    expect(Object.keys(copilotResult.mcpServers)).toEqual(['ruler_server']);

    // Verify Cursor MCP config was overwritten and uses 'mcpServers' key
    const cursorResultText = await fs.readFile(
      path.join(projectRoot, '.cursor', 'mcp.json'),
      'utf8',
    );
    const cursorResult = JSON.parse(cursorResultText);

    // Should have 'mcpServers' key
    expect(cursorResult.mcpServers).toBeDefined();

    // Should contain only ruler server (overwrite should remove native)
    expect(Object.keys(cursorResult.mcpServers)).toEqual(['ruler_server']);
  });
});
