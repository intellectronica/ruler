import * as path from 'path';
import { setupTestProject, teardownTestProject } from './harness';

/**
 * Verifies that using legacy .ruler/mcp.json emits a console warning instructing migration
 * to ruler.toml, matching the style of the legacy instructions.md warning.
 */
describe('legacy mcp.json warning', () => {
  let testProject: { projectRoot: string };
  const warningRegex = /\[ruler] Warning: Using legacy \.ruler\/mcp\.json\./;

  let originalWarn: (...args: any[]) => void;
  let captured: string[];

  beforeEach(async () => {
    originalWarn = console.warn;
    captured = [];
    console.warn = (...args: any[]) => {
      captured.push(args.join(' '));
      originalWarn.apply(console, args);
    };

    const toml = `[mcp]\nenabled = true\n\n[mcp_servers.local]\ncommand = "echo"\nargs = ["hi"]\n`;
    const json = { mcpServers: { legacy: { command: 'echo', args: ['old'] } } };

    testProject = await setupTestProject({
      '.ruler/ruler.toml': toml,
      '.ruler/mcp.json': JSON.stringify(json, null, 2)
    });
  });

  afterEach(async () => {
    console.warn = originalWarn;
    await teardownTestProject(testProject.projectRoot);
  });

  it('emits console warning for legacy mcp.json', async () => {
    const { projectRoot } = testProject;
    const { loadUnifiedConfig } = require('../dist/core/UnifiedConfigLoader');
    await loadUnifiedConfig({ projectRoot });
    expect(captured.some(l => warningRegex.test(l))).toBeTruthy();
  });
});
