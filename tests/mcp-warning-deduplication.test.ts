import { setupTestProject, teardownTestProject, runRulerAll } from './harness';

/**
 * Verifies that the duplicate mcp.json warning issue has been fixed.
 * This test ensures only one warning is shown per ruler apply call.
 */
describe('mcp.json warning deduplication', () => {
  let testProject: { projectRoot: string };
  const warningText = 'Using legacy .ruler/mcp.json';

  beforeEach(async () => {
    testProject = await setupTestProject({
      '.ruler/instructions.md': '# Test rules',
      '.ruler/mcp.json': '{"mcpServers":{}}'
    });
  });

  afterEach(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('shows exactly one warning per apply call', async () => {
    const { projectRoot } = testProject;
    const output = runRulerAll('apply', projectRoot);
    
    // Count occurrences of the warning
    const warningMatches = output.match(/\[ruler\] Warning: Using legacy \.ruler\/mcp\.json/g);
    const warningCount = warningMatches ? warningMatches.length : 0;
    
    expect(warningCount).toBe(1);
    expect(output).toContain(warningText);
  });
});