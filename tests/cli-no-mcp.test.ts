import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { setupTestProject, teardownTestProject, runRulerWithInheritedStdio } from './harness';

describe('cli-no-mcp', () => {
  let testProject: { projectRoot: string };

  beforeEach(async () => {
    const mcp = { mcpServers: { foo: { url: 'http://foo.com' } } };
    const native = { mcpServers: { bar: { url: 'http://bar.com' } } };

    testProject = await setupTestProject({
      '.ruler/mcp.json': JSON.stringify(mcp, null, 2) + '\n',
      '.vscode/mcp.json': JSON.stringify(native, null, 2) + '\n'
    });
  });

  afterEach(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('does not apply MCP when --no-mcp is used', async () => {
    const { projectRoot } = testProject;
    const nativePath = path.join(projectRoot, '.vscode', 'mcp.json');
    const before = await fs.readFile(nativePath, 'utf8');
    
    runRulerWithInheritedStdio('apply --no-mcp', projectRoot);
    
    const after = await fs.readFile(nativePath, 'utf8');
    expect(after).toEqual(before);
  });
});