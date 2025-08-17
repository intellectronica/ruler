import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { execSync } from 'child_process';

describe('apply-mcp.merge', () => {
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
    const native = { servers: { bar: { url: 'http://bar.com' } } };
    await fs.writeFile(
      path.join(vscodeDir, 'mcp.json'),
      JSON.stringify(native, null, 2) + '\n',
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('merges servers from .ruler/mcp.json and existing native config', async () => {
    
    execSync(`node dist/cli/index.js apply --project-root ${tmpDir}`, {
      stdio: 'inherit',
    });
    const resultText = await fs.readFile(
      path.join(tmpDir, '.vscode', 'mcp.json'),
      'utf8',
    );
    const result = JSON.parse(resultText);
    expect(Object.keys(result.servers).sort()).toEqual(['bar', 'foo']);
  });
});