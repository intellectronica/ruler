import * as fs from 'fs/promises';
import * as path from 'path';
import { parse as parseTOML } from '@iarna/toml';
import {
  setupTestProject,
  teardownTestProject,
  runRulerWithInheritedStdio,
} from './harness';

describe('apply-mcp.overwrite', () => {
  let testProject: { projectRoot: string };

  beforeEach(async () => {
    const mcp = { mcpServers: { foo: { url: 'http://foo.com' } } };
    const native = { servers: { bar: { url: 'http://bar.com' } } };

    testProject = await setupTestProject({
      '.ruler/mcp.json': JSON.stringify(mcp, null, 2) + '\n',
      '.vscode/mcp.json': JSON.stringify(native, null, 2) + '\n',
    });
  });

  afterEach(async () => {
    await teardownTestProject(testProject.projectRoot);
  });

  it('overwrites existing native config when --mcp-overwrite is used', async () => {
    const { projectRoot } = testProject;

    runRulerWithInheritedStdio('apply --mcp-overwrite', projectRoot);

    const resultText = await fs.readFile(
      path.join(projectRoot, '.vscode', 'mcp.json'),
      'utf8',
    );
    const result = JSON.parse(resultText);
    expect(Object.keys(result.servers).sort()).toEqual(['foo']);
  });

  it('overwrites OpenHands MCP servers when --mcp-overwrite is used', async () => {
    const { projectRoot } = testProject;
    await fs.writeFile(
      path.join(projectRoot, 'config.toml'),
      `
theme = "dark"

[mcp]
enable_editor = true
stdio_servers = [
  { name = "old", command = "old-command" }
]
shttp_servers = ["http://old.com"]
`,
    );

    runRulerWithInheritedStdio(
      'apply --agents openhands --mcp-overwrite',
      projectRoot,
    );

    const resultText = await fs.readFile(
      path.join(projectRoot, 'config.toml'),
      'utf8',
    );
    const result: any = parseTOML(resultText);
    expect(result.theme).toBe('dark');
    expect(result.mcp.enable_editor).toBe(true);
    expect(result.mcp.stdio_servers).toEqual([]);
    expect(result.mcp.shttp_servers).toEqual(['http://foo.com']);
  });

  it('overwrites OpenCode MCP servers when --mcp-overwrite is used', async () => {
    const { projectRoot } = testProject;
    await fs.writeFile(
      path.join(projectRoot, 'opencode.json'),
      JSON.stringify(
        {
          $schema: 'https://opencode.ai/config.json',
          theme: 'dark',
          mcp: {
            old: {
              type: 'remote',
              url: 'http://old.com',
              enabled: true,
            },
          },
        },
        null,
        2,
      ),
    );

    runRulerWithInheritedStdio(
      'apply --agents opencode --mcp-overwrite',
      projectRoot,
    );

    const resultText = await fs.readFile(
      path.join(projectRoot, 'opencode.json'),
      'utf8',
    );
    const result = JSON.parse(resultText);
    expect(result.theme).toBe('dark');
    expect(Object.keys(result.mcp)).toEqual(['foo']);
    expect(result.mcp.foo).toEqual({
      type: 'remote',
      url: 'http://foo.com',
      enabled: true,
    });
  });
});
