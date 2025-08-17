import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { execSync } from 'child_process';

describe('cli-no-mcp', () => {
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
    const native = { mcpServers: { bar: { url: 'http://bar.com' } } };
    const nativePath = path.join(vscodeDir, 'mcp.json');
    await fs.writeFile(nativePath, JSON.stringify(native, null, 2) + '\n');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('does not apply MCP when --no-mcp is used', async () => {
    const nativePath = path.join(tmpDir, '.vscode', 'mcp.json');
    const before = await fs.readFile(nativePath, 'utf8');
    
    execSync(
      `node dist/cli/index.js apply --project-root ${tmpDir} --no-mcp`,
      { stdio: 'inherit' },
    );
    const after = await fs.readFile(nativePath, 'utf8');
    expect(after).toEqual(before);
  });
});