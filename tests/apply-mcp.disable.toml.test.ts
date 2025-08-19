import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { setupTestProject, teardownTestProject, runRulerWithInheritedStdio } from './harness';

describe('apply-mcp.disable.toml', () => {
  let testProject: { projectRoot: string };

  beforeEach(async () => {
    const mcp = { mcpServers: { foo: { url: 'http://foo.com' } } };
    const native = { mcpServers: { bar: { url: 'http://bar.com' } } };
    const toml = `[mcp]
enabled = false
`;

    testProject = await setupTestProject({
      '.ruler/mcp.json': JSON.stringify(mcp, null, 2) + '\n',
      '.vscode/mcp.json': JSON.stringify(native, null, 2) + '\n',
      '.ruler/ruler.toml': toml
    });
  });

  afterEach(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('does not touch native config when [mcp] enabled=false', async () => {
    const { projectRoot } = testProject;
    const nativePath = path.join(projectRoot, '.vscode', 'mcp.json');
    const before = await fs.readFile(nativePath, 'utf8');
    
    runRulerWithInheritedStdio('apply', projectRoot);
    
    const after = await fs.readFile(nativePath, 'utf8');
    expect(after).toEqual(before);
  });
});