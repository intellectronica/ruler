import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { applyAllAgentConfigs } from '../../src/lib';

describe('OpenCode Agent Integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-opencode-integration-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should create opencode.json file when running ruler apply without MCP config', async () => {
    // Create a minimal .ruler directory structure without mcp.json
    const rulerDir = path.join(tmpDir, '.ruler');
    await fs.mkdir(rulerDir, { recursive: true });
    
    // Create basic AGENTS.md file
    await fs.writeFile(
      path.join(rulerDir, 'AGENTS.md'),
      '# Test Rules\n\nThese are test rules for the OpenCode agent.'
    );

    // Run ruler apply for just the OpenCode agent
    await applyAllAgentConfigs(tmpDir, ['opencode'], undefined, true, undefined, false, false, false, true);

    // Verify that opencode.json was created
    const openCodePath = path.join(tmpDir, 'opencode.json');
    const content = await fs.readFile(openCodePath, 'utf8');
    const config = JSON.parse(content);

    expect(config.$schema).toBe('https://opencode.ai/config.json');
    expect(config.mcp).toEqual({});
  });

  it('should create opencode.json with MCP servers when MCP config exists', async () => {
    // Create .ruler directory structure with mcp.json
    const rulerDir = path.join(tmpDir, '.ruler');
    await fs.mkdir(rulerDir, { recursive: true });
    
    // Create basic AGENTS.md file
    await fs.writeFile(
      path.join(rulerDir, 'AGENTS.md'),
      '# Test Rules\n\nThese are test rules for the OpenCode agent.'
    );

    // Create ruler.toml with MCP config
    const rulerToml = `
[mcp]
enabled = true

[mcp_servers.test-server]
command = "echo"
args = ["hello"]
`;
    await fs.writeFile(path.join(rulerDir, 'ruler.toml'), rulerToml);

    // Run ruler apply for just the OpenCode agent
    await applyAllAgentConfigs(tmpDir, ['opencode'], undefined, true, undefined, false, false, false, true);

    // Verify that opencode.json was created with the MCP server
    const openCodePath = path.join(tmpDir, 'opencode.json');
    const content = await fs.readFile(openCodePath, 'utf8');
    const config = JSON.parse(content);

    expect(config.$schema).toBe('https://opencode.ai/config.json');
    expect(config.mcp['test-server']).toEqual({
      type: 'local',
      command: ['echo', 'hello'],
      enabled: true,
    });
  });
});