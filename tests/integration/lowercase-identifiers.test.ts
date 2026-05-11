import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { applyAllAgentConfigs } from '../../src/lib';

describe('Lowercase Identifiers Integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-lowercase-integration-'));
    
    // Create .ruler directory with basic files
    const rulerDir = path.join(tmpDir, '.ruler');
    await fs.mkdir(rulerDir, { recursive: true });
    await fs.writeFile(path.join(rulerDir, 'instructions.md'), '# Test instructions');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('supports lowercase identifiers in CLI --agents option', async () => {
    // Create a config with mixed case
    const configContent = `
[agents.COPILOT]
enabled = true

[agents.Claude]  
enabled = true
`;
    await fs.writeFile(path.join(tmpDir, '.ruler', 'ruler.toml'), configContent);

    // Test with lowercase CLI identifiers - this should work
    await expect(
      applyAllAgentConfigs(
        tmpDir,
        ['copilot', 'claude'], // lowercase identifiers
        undefined,
        false, // no MCP
        undefined,
        false, // no gitignore
        false, // not verbose
        true, // dry run
      )
    ).resolves.not.toThrow();
  });

  it('supports lowercase identifiers in default_agents config', async () => {
    const configContent = `
default_agents = ["copilot", "claude"]

[agents.copilot]
enabled = true

[agents.claude]
enabled = true
`;
    await fs.writeFile(path.join(tmpDir, '.ruler', 'ruler.toml'), configContent);

    // Test that lowercase default_agents work
    await expect(
      applyAllAgentConfigs(
        tmpDir,
        undefined, // no CLI agents
        undefined,
        false, // no MCP
        undefined,
        false, // no gitignore
        false, // not verbose
        true, // dry run
      )
    ).resolves.not.toThrow();
  });

  it('normalizes mixed case config keys to work with lowercase identifiers', async () => {
    const configContent = `
[agents.COPILOT]
enabled = true
output_path = "CUSTOM_COPILOT.md"

[agents.Claude]
enabled = false

[agents.aider]
enabled = true
`;
    await fs.writeFile(path.join(tmpDir, '.ruler', 'ruler.toml'), configContent);

    // Test with lowercase CLI filters
    await expect(
      applyAllAgentConfigs(
        tmpDir,
        ['copilot', 'aider'], // Should find COPILOT and aider configs
        undefined,
        false, // no MCP
        undefined,
        false, // no gitignore
        false, // not verbose
        true, // dry run
      )
    ).resolves.not.toThrow();
  });
});