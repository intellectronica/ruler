import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { applyAllAgentConfigs } from '../../src/lib';
import { revertAllAgentConfigs } from '../../src/revert';

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeProject(projectRoot: string, rulerToml: string) {
  const rulerDir = path.join(projectRoot, '.ruler');
  await fs.mkdir(rulerDir, { recursive: true });
  await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), '# Rules\n');
  await fs.writeFile(path.join(rulerDir, 'ruler.toml'), rulerToml);
}

describe('MCP custom config paths', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-mcp-paths-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('writes Codex MCP config only to output_path_config', async () => {
    await writeProject(
      tmpDir,
      `
[agents.codex]
output_path_config = "custom/codex.toml"

[mcp_servers.repo]
command = "node"
args = ["server.js"]
`,
    );

    await applyAllAgentConfigs(
      tmpDir,
      ['codex'],
      undefined,
      true,
      undefined,
      false,
      false,
      false,
      true,
    );

    const customPath = path.join(tmpDir, 'custom', 'codex.toml');
    const defaultPath = path.join(tmpDir, '.codex', 'config.toml');

    await expect(pathExists(customPath)).resolves.toBe(true);
    await expect(pathExists(defaultPath)).resolves.toBe(false);

    const content = await fs.readFile(customPath, 'utf8');
    expect(content).toContain('[mcp_servers.repo]');
    expect(content).toContain('command = "node"');
  });

  it('writes OpenCode MCP config only to output_path_config', async () => {
    await writeProject(
      tmpDir,
      `
[agents.opencode]
output_path_config = "custom/opencode.json"

[mcp_servers.repo]
command = "node"
args = ["server.js"]
`,
    );

    await applyAllAgentConfigs(
      tmpDir,
      ['opencode'],
      undefined,
      true,
      undefined,
      false,
      false,
      false,
      true,
    );

    const customPath = path.join(tmpDir, 'custom', 'opencode.json');
    const defaultPath = path.join(tmpDir, 'opencode.json');

    await expect(pathExists(customPath)).resolves.toBe(true);
    await expect(pathExists(defaultPath)).resolves.toBe(false);

    const config = JSON.parse(await fs.readFile(customPath, 'utf8'));
    expect(config.mcp.repo).toEqual({
      type: 'local',
      command: ['node', 'server.js'],
      enabled: true,
    });
  });

  it('writes Gemini MCP config only to output_path_config', async () => {
    await writeProject(
      tmpDir,
      `
[agents.gemini-cli]
output_path_config = "custom/gemini-settings.json"

[mcp_servers.repo]
command = "node"
args = ["server.js"]
`,
    );

    await applyAllAgentConfigs(
      tmpDir,
      ['gemini-cli'],
      undefined,
      true,
      undefined,
      false,
      false,
      false,
      true,
    );

    const customPath = path.join(tmpDir, 'custom', 'gemini-settings.json');
    const defaultPath = path.join(tmpDir, '.gemini', 'settings.json');

    await expect(pathExists(customPath)).resolves.toBe(true);
    await expect(pathExists(defaultPath)).resolves.toBe(false);

    const config = JSON.parse(await fs.readFile(customPath, 'utf8'));
    expect(config.mcpServers.repo).toEqual({
      command: 'node',
      args: ['server.js'],
    });
  });

  it('writes Zed MCP config only to output_path_config', async () => {
    await writeProject(
      tmpDir,
      `
[agents.zed]
output_path_config = "custom/zed-settings.json"

[mcp_servers.repo]
command = "node"
args = ["server.js"]
`,
    );

    await applyAllAgentConfigs(
      tmpDir,
      ['zed'],
      undefined,
      true,
      undefined,
      false,
      false,
      false,
      true,
    );

    const customPath = path.join(tmpDir, 'custom', 'zed-settings.json');
    const defaultPath = path.join(tmpDir, '.zed', 'settings.json');

    await expect(pathExists(customPath)).resolves.toBe(true);
    await expect(pathExists(defaultPath)).resolves.toBe(false);

    const config = JSON.parse(await fs.readFile(customPath, 'utf8'));
    expect(config.context_servers.repo).toEqual({
      command: 'node',
      args: ['server.js'],
      source: 'custom',
    });
  });

  it('reverts MCP config written to output_path_config', async () => {
    await writeProject(
      tmpDir,
      `
[agents.opencode]
output_path_config = "custom/opencode.json"

[mcp_servers.repo]
command = "node"
args = ["server.js"]
`,
    );

    await applyAllAgentConfigs(tmpDir, ['opencode']);

    const customPath = path.join(tmpDir, 'custom', 'opencode.json');
    const defaultPath = path.join(tmpDir, 'opencode.json');

    await expect(pathExists(customPath)).resolves.toBe(true);
    await expect(pathExists(defaultPath)).resolves.toBe(false);

    await revertAllAgentConfigs(
      tmpDir,
      ['opencode'],
      undefined,
      false,
      false,
      false,
    );

    await expect(pathExists(customPath)).resolves.toBe(false);
    await expect(pathExists(defaultPath)).resolves.toBe(false);
  });

  it('rejects custom MCP config paths outside the project root', async () => {
    const outsideDir = `${tmpDir}-outside`;
    const outsideConfig = path.join(outsideDir, 'opencode.json');
    const outsideRelative = path.relative(tmpDir, outsideConfig);

    await writeProject(
      tmpDir,
      `
[agents.opencode]
output_path_config = "${outsideRelative.replace(/\\/g, '/')}"

[mcp_servers.repo]
command = "node"
args = ["server.js"]
`,
    );

    await expect(
      applyAllAgentConfigs(
        tmpDir,
        ['opencode'],
        undefined,
        true,
        undefined,
        false,
        false,
        false,
        true,
      ),
    ).rejects.toThrow(/Configured output path is outside the project root/i);

    await expect(pathExists(outsideConfig)).resolves.toBe(false);

    const gitignore = (await pathExists(path.join(tmpDir, '.gitignore')))
      ? await fs.readFile(path.join(tmpDir, '.gitignore'), 'utf8')
      : '';
    expect(gitignore).not.toContain(path.basename(outsideDir));
  });
});
