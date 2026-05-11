import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { setupTestProject, teardownTestProject, runRulerWithInheritedStdio } from './harness';

describe('apply-mcp.merge', () => {
  let testProject: { projectRoot: string };

  beforeEach(async () => {
    const mcp = { mcpServers: { foo: { url: 'http://foo.com' } } };
    const native = { servers: { bar: { url: 'http://bar.com' } } };

    testProject = await setupTestProject({
      '.ruler/mcp.json': JSON.stringify(mcp, null, 2) + '\n',
      '.vscode/mcp.json': JSON.stringify(native, null, 2) + '\n'
    });
  });

  afterEach(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('merges servers from .ruler/mcp.json and existing native config', async () => {
    const { projectRoot } = testProject;
    
    runRulerWithInheritedStdio('apply', projectRoot);
    
    const resultText = await fs.readFile(
      path.join(projectRoot, '.vscode', 'mcp.json'),
      'utf8',
    );
    const result = JSON.parse(resultText);
    expect(Object.keys(result.servers).sort()).toEqual(['bar', 'foo']);
  });
});