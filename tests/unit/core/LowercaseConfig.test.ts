import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { loadConfig } from '../../../src/core/ConfigLoader';
import { applyAllAgentConfigs } from '../../../src/lib';

describe('Lowercase Configuration Support', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-lowercase-config-'));
    
    // Create .ruler directory
    const rulerDir = path.join(tmpDir, '.ruler');
    await fs.mkdir(rulerDir, { recursive: true });
    
    // Create a basic instructions file
    await fs.writeFile(path.join(rulerDir, 'instructions.md'), '# Test instructions');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('supports lowercase agent identifiers in default_agents', async () => {
    const configContent = `
default_agents = ["copilot", "claude", "aider"]

[agents.copilot]
enabled = true

[agents.claude]
enabled = false
`;
    
    const configPath = path.join(tmpDir, '.ruler', 'ruler.toml');
    await fs.writeFile(configPath, configContent);

    const config = await loadConfig({
      projectRoot: tmpDir,
      configPath,
    });

    expect(config.defaultAgents).toEqual(['copilot', 'claude', 'aider']);
    expect(config.agentConfigs.copilot?.enabled).toBe(true);
    expect(config.agentConfigs.claude?.enabled).toBe(false);
  });

  it('supports mixed case agent identifiers in CLI agents', async () => {
    const config = await loadConfig({
      projectRoot: tmpDir,
      cliAgents: ['copilot', 'CLAUDE', 'Aider'],
    });

    expect(config.cliAgents).toEqual(['copilot', 'CLAUDE', 'Aider']);
  });

  it('normalizes agent config keys to lowercase', async () => {
    const configContent = `
[agents.COPILOT]
enabled = true

[agents.Claude]
enabled = false

[agents.aider]
enabled = true
`;
    
    const configPath = path.join(tmpDir, '.ruler', 'ruler.toml');
    await fs.writeFile(configPath, configContent);

    const config = await loadConfig({
      projectRoot: tmpDir,
      configPath,
    });

    // ConfigLoader preserves the original casing, normalization happens in lib.ts
    expect(config.agentConfigs.COPILOT?.enabled).toBe(true);
    expect(config.agentConfigs.Claude?.enabled).toBe(false);
    expect(config.agentConfigs.aider?.enabled).toBe(true);
  });

  it('provides correct output paths for all agents', async () => {
    const configContent = `
[agents.copilot]
output_path = "custom/copilot.md"

[agents.claude]
output_path = "CUSTOM_CLAUDE.md"

[agents.aider]
output_path_instructions = "custom_aider.md"
output_path_config = "custom_aider.yml"
`;
    
    const configPath = path.join(tmpDir, '.ruler', 'ruler.toml');
    await fs.writeFile(configPath, configContent);

    const config = await loadConfig({
      projectRoot: tmpDir,
      configPath,
    });

    // ConfigLoader resolves paths to absolute paths
    expect(config.agentConfigs.copilot?.outputPath).toBe(path.join(tmpDir, 'custom/copilot.md'));
    expect(config.agentConfigs.claude?.outputPath).toBe(path.join(tmpDir, 'CUSTOM_CLAUDE.md'));
    expect(config.agentConfigs.aider?.outputPathInstructions).toBe(path.join(tmpDir, 'custom_aider.md'));
    expect(config.agentConfigs.aider?.outputPathConfig).toBe(path.join(tmpDir, 'custom_aider.yml'));
  });
});