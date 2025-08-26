import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';

import { loadConfig, LoadedConfig } from '../../../src/core/ConfigLoader';

describe('ConfigLoader', () => {
  let tmpDir: string;
  let rulerDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-config-'));
    rulerDir = path.join(tmpDir, '.ruler');
    await fs.mkdir(rulerDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns empty config when file does not exist', async () => {
    const config = await loadConfig({ projectRoot: tmpDir });
    expect(config.defaultAgents).toBeUndefined();
    expect(config.agentConfigs).toEqual({});
    expect(config.cliAgents).toBeUndefined();
  });

  it('returns empty config when file is empty', async () => {
    await fs.writeFile(path.join(rulerDir, 'ruler.toml'), '');
    const config = await loadConfig({ projectRoot: tmpDir });
    expect(config.defaultAgents).toBeUndefined();
    expect(config.agentConfigs).toEqual({});
  });

  it('parses default_agents', async () => {
    const content = `default_agents = ["A", "B"]`;
    await fs.writeFile(path.join(rulerDir, 'ruler.toml'), content);
    const config = await loadConfig({ projectRoot: tmpDir });
    expect(config.defaultAgents).toEqual(['A', 'B']);
  });

  it('parses nested configuration option', async () => {
    const content = `nested = true`;
    await fs.writeFile(path.join(rulerDir, 'ruler.toml'), content);
    const config = await loadConfig({ projectRoot: tmpDir });
    expect(config.nested).toBe(true);
  });

  it('defaults nested to undefined when not specified', async () => {
    const content = `default_agents = ["A"]`;
    await fs.writeFile(path.join(rulerDir, 'ruler.toml'), content);
    const config = await loadConfig({ projectRoot: tmpDir });
    expect(config.nested).toBe(false);
  });

  it('parses agent enabled overrides', async () => {
    const content = `
      [agents.A]
      enabled = false
      [agents.B]
      enabled = true
    `;
    await fs.writeFile(path.join(rulerDir, 'ruler.toml'), content);
    const config = await loadConfig({ projectRoot: tmpDir });
    expect(config.agentConfigs.A.enabled).toBe(false);
    expect(config.agentConfigs.B.enabled).toBe(true);
  });

  it('parses agent output_path and resolves to projectRoot', async () => {
    const content = `
      [agents.A]
      output_path = "foo/bar.md"
    `;
    await fs.writeFile(path.join(rulerDir, 'ruler.toml'), content);
    const config = await loadConfig({ projectRoot: tmpDir });
    expect(config.agentConfigs.A.outputPath).toBe(
      path.resolve(tmpDir, 'foo/bar.md'),
    );
  });

  it('parses agent output_path_instructions and resolves to projectRoot', async () => {
    const content = `
    [agents.A]
    output_path_instructions = "foo/instructions.md"
  `;
    await fs.writeFile(path.join(rulerDir, 'ruler.toml'), content);
    const config = await loadConfig({ projectRoot: tmpDir });
    expect(config.agentConfigs.A.outputPathInstructions).toBe(
      path.resolve(tmpDir, 'foo/instructions.md'),
    );
  });

  it('parses agent output_path_config and resolves to projectRoot', async () => {
    const content = `
    [agents.A]
    output_path_config = "foo/config.toml"
  `;
    await fs.writeFile(path.join(rulerDir, 'ruler.toml'), content);
    const config = await loadConfig({ projectRoot: tmpDir });
    expect(config.agentConfigs.A.outputPathConfig).toBe(
      path.resolve(tmpDir, 'foo/config.toml'),
    );
  });

  it('loads config from custom path via configPath option', async () => {
    const altDir = path.join(tmpDir, 'alt');
    await fs.mkdir(altDir, { recursive: true });
    const altPath = path.join(altDir, 'myconfig.toml');
    await fs.writeFile(altPath, `default_agents = ["X"]`);
    const config = await loadConfig({
      projectRoot: tmpDir,
      configPath: altPath,
    });
    expect(config.defaultAgents).toEqual(['X']);
  });

  it('captures CLI agents override', async () => {
    const overrides = ['C', 'D'];
    const config = await loadConfig({
      projectRoot: tmpDir,
      cliAgents: overrides,
    });
    expect(config.cliAgents).toEqual(overrides);
  });

  describe('gitignore configuration', () => {
    it('parses [gitignore] section with enabled = true', async () => {
      const content = `
        [gitignore]
        enabled = true
      `;
      await fs.writeFile(path.join(rulerDir, 'ruler.toml'), content);
      const config = await loadConfig({ projectRoot: tmpDir });
      expect(config.gitignore).toBeDefined();
      expect(config.gitignore?.enabled).toBe(true);
    });

    it('parses [gitignore] section with enabled = false', async () => {
      const content = `
        [gitignore]
        enabled = false
      `;
      await fs.writeFile(path.join(rulerDir, 'ruler.toml'), content);
      const config = await loadConfig({ projectRoot: tmpDir });
      expect(config.gitignore).toBeDefined();
      expect(config.gitignore?.enabled).toBe(false);
    });

    it('parses [gitignore] section with missing enabled key', async () => {
      const content = `
        [gitignore]
        # enabled key not specified
      `;
      await fs.writeFile(path.join(rulerDir, 'ruler.toml'), content);
      const config = await loadConfig({ projectRoot: tmpDir });
      expect(config.gitignore).toBeDefined();
      expect(config.gitignore?.enabled).toBeUndefined();
    });

    it('handles missing [gitignore] section', async () => {
      const content = `
        default_agents = ["A"]
      `;
      await fs.writeFile(path.join(rulerDir, 'ruler.toml'), content);
      const config = await loadConfig({ projectRoot: tmpDir });
      expect(config.gitignore).toBeDefined();
      expect(config.gitignore?.enabled).toBeUndefined();
    });

    it('handles empty config file for gitignore', async () => {
      await fs.writeFile(path.join(rulerDir, 'ruler.toml'), '');
      const config = await loadConfig({ projectRoot: tmpDir });
      expect(config.gitignore).toBeDefined();
      expect(config.gitignore?.enabled).toBeUndefined();
    });
  });
});
