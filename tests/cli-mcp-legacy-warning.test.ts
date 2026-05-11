import { setupTestProject, teardownTestProject, runRulerAll } from './harness';

/**
 * Ensures CLI emits legacy mcp.json warning during apply even if unified config path misses it.
 */
describe('CLI legacy mcp.json warning', () => {
  let testProject: { projectRoot: string };
  const warningText = 'Using legacy .ruler/mcp.json';

  beforeEach(async () => {
    testProject = await setupTestProject({
      '.ruler/instructions.md': '# Legacy rules',
      '.ruler/mcp.json': '{"mcpServers":{}}'
    });
  });

  afterEach(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('prints warning', async () => {
    const { projectRoot } = testProject;
  const output = runRulerAll('apply', projectRoot);
    expect(output).toContain(warningText);
  });
});
