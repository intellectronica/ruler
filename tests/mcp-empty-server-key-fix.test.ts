import * as fs from 'fs/promises';
import * as path from 'path';
import { setupTestProject, teardownTestProject, runRulerWithInheritedStdio } from './harness';

describe('mcp-empty-server-key-fix', () => {
  let testProject: { projectRoot: string };

  beforeEach(async () => {
    // Create ruler MCP config
    const rulerMcp = { mcpServers: { ruler_server: { url: 'http://ruler.com' } } };

    testProject = await setupTestProject({
      '.ruler/mcp.json': JSON.stringify(rulerMcp, null, 2) + '\n'
    });
  });

  afterEach(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('should not create empty string key when applying to agents that return empty string from getMcpServerKey', async () => {
    const { projectRoot } = testProject;
    
    // Apply to Goose agent which returns empty string from getMcpServerKey()
    runRulerWithInheritedStdio('apply --agents goose', projectRoot);

    // Goose doesn't actually create MCP files (it doesn't support MCP), 
    // but let's verify it doesn't break or create invalid configs
    // This test mainly ensures the fix doesn't cause runtime errors
    
    // The main thing is that the command completes successfully without throwing errors
    const gooseHintsPath = path.join(projectRoot, '.goosehints');
    const exists = await fs.access(gooseHintsPath).then(() => true).catch(() => false);
    expect(exists).toBe(true); // Goose should create its hints file
  });

  it('should not create empty string key when applying to Claude Code', async () => {
    const { projectRoot } = testProject;
    
    // Create Claude MCP config - initially empty 
    const claudeNative = { mcpServers: { native_claude_server: { url: 'http://claude.com' } } };
    await fs.writeFile(
      path.join(projectRoot, '.mcp.json'),
      JSON.stringify(claudeNative, null, 2) + '\n'
    );
    
    runRulerWithInheritedStdio('apply --agents claude', projectRoot);

    // Verify Claude MCP config uses 'mcpServers' key, not empty string
    const claudeResultText = await fs.readFile(
      path.join(projectRoot, '.mcp.json'),
      'utf8',
    );
    const claudeResult = JSON.parse(claudeResultText);
    
    // Should have 'mcpServers' key, not empty string key
    expect(claudeResult.mcpServers).toBeDefined();
    expect(claudeResult[""]).toBeUndefined(); // Should not have empty string key
    
    // Should contain both native and ruler servers
    expect(Object.keys(claudeResult.mcpServers).sort()).toEqual(['native_claude_server', 'ruler_server']);
  });

  it('should not create empty string key when applying to multiple agents including ones with empty getMcpServerKey', async () => {
    const { projectRoot } = testProject;
    
    // Create Claude MCP config  
    const claudeNative = { mcpServers: { native_claude_server: { url: 'http://claude.com' } } };
    await fs.writeFile(
      path.join(projectRoot, '.mcp.json'),
      JSON.stringify(claudeNative, null,2) + '\n'
    );
    
    // Create Cursor MCP config
    const cursorNative = { mcpServers: { native_cursor_server: { url: 'http://cursor.com' } } };
    await fs.mkdir(path.join(projectRoot, '.cursor'), { recursive: true });
    await fs.writeFile(
      path.join(projectRoot, '.cursor', 'mcp.json'),
      JSON.stringify(cursorNative, null, 2) + '\n'
    );
    
    // Apply to multiple agents including Goose (which returns empty string) and Claude
    runRulerWithInheritedStdio('apply --agents claude,cursor,goose', projectRoot);

    // Verify Claude MCP config is correct
    const claudeResultText = await fs.readFile(
      path.join(projectRoot, '.mcp.json'),
      'utf8',
    );
    const claudeResult = JSON.parse(claudeResultText);
    expect(claudeResult.mcpServers).toBeDefined();
    expect(claudeResult[""]).toBeUndefined();
    
    // Verify Cursor MCP config is correct
    const cursorResultText = await fs.readFile(
      path.join(projectRoot, '.cursor', 'mcp.json'),
      'utf8',
    );
    const cursorResult = JSON.parse(cursorResultText);
    expect(cursorResult.mcpServers).toBeDefined();
    expect(cursorResult[""]).toBeUndefined();
    
    // Verify Goose created its hints file
    const gooseHintsPath = path.join(projectRoot, '.goosehints');
    const gooseExists = await fs.access(gooseHintsPath).then(() => true).catch(() => false);
    expect(gooseExists).toBe(true);
  });
});