import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { execSync } from 'child_process';

describe('agent-specific-disable', () => {
  let tmpDir: string;
  let rulerDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-mcp-'));
    rulerDir = path.join(tmpDir, '.ruler');
    await fs.mkdir(rulerDir, { recursive: true });
    const mcp = { mcpServers: { foo: { url: 'http://foo.com' } } };
    await fs.writeFile(
      path.join(rulerDir, 'mcp.json'),
      JSON.stringify(mcp, null, 2) + '\n',
    );
    const vscodeDir = path.join(tmpDir, '.vscode');
    await fs.mkdir(vscodeDir, { recursive: true });
    const nativeVs = { mcpServers: { bar: { url: 'http://bar.com' } } };
    await fs.writeFile(
      path.join(vscodeDir, 'mcp.json'),
      JSON.stringify(nativeVs, null, 2) + '\n',
    );
    const cursorDir = path.join(tmpDir, '.cursor');
    await fs.mkdir(cursorDir, { recursive: true });
    const nativeCur = { mcpServers: { baz: { url: 'http://baz.com' } } };
    await fs.writeFile(
      path.join(cursorDir, 'mcp.json'),
      JSON.stringify(nativeCur, null, 2) + '\n',
    );
    const toml = `[mcp]
enabled = true

[agents.Cursor.mcp]
enabled = false
`;
    await fs.writeFile(path.join(rulerDir, 'ruler.toml'), toml);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('skips disabled agent but merges others', async () => {
    execSync('npm run build', { stdio: 'inherit' });
    execSync(`node dist/cli/index.js apply --project-root ${tmpDir}`, {
      stdio: 'inherit',
    });
    const copilot = JSON.parse(
      await fs.readFile(path.join(tmpDir, '.vscode', 'mcp.json'), 'utf8'),
    );
    expect(Object.keys(copilot.mcpServers).sort()).toEqual(['bar', 'foo']);
    const cursor = JSON.parse(
      await fs.readFile(path.join(tmpDir, '.cursor', 'mcp.json'), 'utf8'),
    );
    expect(Object.keys(cursor.mcpServers).sort()).toEqual(['baz']);
  });
});