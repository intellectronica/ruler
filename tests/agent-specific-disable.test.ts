import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { setupTestProject, teardownTestProject, runRulerWithInheritedStdio } from './harness';

describe('agent-specific-disable', () => {
  let testProject: { projectRoot: string };

  beforeEach(async () => {
    const mcp = { mcpServers: { foo: { url: 'http://foo.com' } } };
    const nativeVs = { servers: { bar: { url: 'http://bar.com' } } };
    const nativeCur = { mcpServers: { baz: { url: 'http://baz.com' } } };
    const toml = `[mcp]
enabled = true

[agents.Cursor.mcp]
enabled = false
`;

    testProject = await setupTestProject({
      '.ruler/mcp.json': JSON.stringify(mcp, null, 2) + '\n',
      '.vscode/mcp.json': JSON.stringify(nativeVs, null, 2) + '\n',
      '.cursor/mcp.json': JSON.stringify(nativeCur, null, 2) + '\n',
      '.ruler/ruler.toml': toml
    });
  });

  afterEach(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('skips disabled agent but merges others', async () => {
    const { projectRoot } = testProject;
    
    runRulerWithInheritedStdio('apply', projectRoot);
    
    const copilot = JSON.parse(
      await fs.readFile(path.join(projectRoot, '.vscode', 'mcp.json'), 'utf8'),
    );
    expect(Object.keys(copilot.servers).sort()).toEqual(['bar', 'foo']);
    const cursor = JSON.parse(
      await fs.readFile(path.join(projectRoot, '.cursor', 'mcp.json'), 'utf8'),
    );
    expect(Object.keys(cursor.mcpServers).sort()).toEqual(['baz']);
  });
});