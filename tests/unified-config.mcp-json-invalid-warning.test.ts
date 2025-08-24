import { setupTestProject, teardownTestProject } from './harness';

/**
 * Ensures warning still appears for legacy mcp.json even if file contains invalid JSON.
 */
describe('legacy mcp.json invalid still warns', () => {
  let testProject: { projectRoot: string };
  const warningRegex = /legacy \.ruler\/mcp\.json/;
  let originalWarn: (...args: any[]) => void;
  let captured: string[];

  beforeEach(async () => {
    originalWarn = console.warn;
    captured = [];
    console.warn = (...args: any[]) => {
      captured.push(args.join(' '));
      return originalWarn.apply(console, args as any);
    };

    // Invalid JSON content
    testProject = await setupTestProject({
      '.ruler/mcp.json': '{ invalid: true ',
    });
  });

  afterEach(async () => {
    console.warn = originalWarn;
    await teardownTestProject(testProject.projectRoot);
  });

  it('emits warning even with invalid JSON', async () => {
    const { projectRoot } = testProject;
    const { loadUnifiedConfig } = require('../dist/core/UnifiedConfigLoader');
    await loadUnifiedConfig({ projectRoot });
    expect(captured.some(l => warningRegex.test(l))).toBeTruthy();
  });
});
