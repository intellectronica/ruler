import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';

import {
  loadConfig,
  LoadedConfig,
  _resetLegacySubagentsWarningForTests,
} from '../../../src/core/ConfigLoader';

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

    it('parses [gitignore] section with local = true', async () => {
      const content = `
        [gitignore]
        local = true
      `;
      await fs.writeFile(path.join(rulerDir, 'ruler.toml'), content);
      const config = await loadConfig({ projectRoot: tmpDir });
      expect(config.gitignore).toBeDefined();
      expect(config.gitignore?.local).toBe(true);
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

  describe('subagent control via [agents] (and legacy [subagents])', () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      _resetLegacySubagentsWarningForTests();
      warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('parses [agents] enabled and include_in_rules', async () => {
      const content = '[agents]\nenabled = true\ninclude_in_rules = true\n';
      await fs.writeFile(path.join(rulerDir, 'ruler.toml'), content);
      const config = await loadConfig({ projectRoot: tmpDir });
      expect(config.subagents?.enabled).toBe(true);
      expect(config.subagents?.include_in_rules).toBe(true);
    });

    it('does not treat reserved keys as agent configs', async () => {
      const content =
        '[agents]\nenabled = true\ninclude_in_rules = false\n\n[agents.claude]\nenabled = false\n';
      await fs.writeFile(path.join(rulerDir, 'ruler.toml'), content);
      const config = await loadConfig({ projectRoot: tmpDir });
      // Reserved keys flow into subagents, NOT agentConfigs
      expect(config.agentConfigs).not.toHaveProperty('enabled');
      expect(config.agentConfigs).not.toHaveProperty('include_in_rules');
      expect(config.agentConfigs).toHaveProperty('claude');
      expect(config.agentConfigs.claude.enabled).toBe(false);
      expect(config.subagents?.enabled).toBe(true);
      expect(config.subagents?.include_in_rules).toBe(false);
    });

    it('parses upstream-style [agents.*] only (no reserved keys)', async () => {
      const content =
        '[agents.claude]\nenabled = false\n\n[agents.cursor]\nenabled = true\n';
      await fs.writeFile(path.join(rulerDir, 'ruler.toml'), content);
      const config = await loadConfig({ projectRoot: tmpDir });
      expect(config.agentConfigs.claude.enabled).toBe(false);
      expect(config.agentConfigs.cursor.enabled).toBe(true);
      expect(config.subagents?.enabled).toBeUndefined();
      expect(config.subagents?.include_in_rules).toBeUndefined();
    });

    it('honors legacy [subagents] when [agents] keys are absent', async () => {
      const content = '[subagents]\nenabled = true\ninclude_in_rules = true\n';
      await fs.writeFile(path.join(rulerDir, 'ruler.toml'), content);
      const config = await loadConfig({ projectRoot: tmpDir });
      expect(config.subagents?.enabled).toBe(true);
      expect(config.subagents?.include_in_rules).toBe(true);
    });

    it('emits a deprecation warning for legacy [subagents]', async () => {
      const content = '[subagents]\nenabled = true\n';
      await fs.writeFile(path.join(rulerDir, 'ruler.toml'), content);
      await loadConfig({ projectRoot: tmpDir });
      const messages = warnSpy.mock.calls.map((args) => String(args[0]));
      const deprecation = messages.find(
        (m) => m.includes('[subagents]') && m.includes('deprecated'),
      );
      expect(deprecation).toBeDefined();
    });

    it('warns about legacy [subagents] only once across multiple loadConfig calls', async () => {
      const content = '[subagents]\nenabled = true\n';
      await fs.writeFile(path.join(rulerDir, 'ruler.toml'), content);
      await loadConfig({ projectRoot: tmpDir });
      await loadConfig({ projectRoot: tmpDir });
      await loadConfig({ projectRoot: tmpDir });
      const deprecationCalls = warnSpy.mock.calls.filter((args) =>
        String(args[0]).includes('[subagents]'),
      );
      expect(deprecationCalls).toHaveLength(1);
    });

    it('does not warn when only [agents] is used', async () => {
      const content = '[agents]\nenabled = true\n';
      await fs.writeFile(path.join(rulerDir, 'ruler.toml'), content);
      await loadConfig({ projectRoot: tmpDir });
      const deprecation = warnSpy.mock.calls.find((args) =>
        String(args[0]).includes('[subagents]'),
      );
      expect(deprecation).toBeUndefined();
    });

    it('applies per-key precedence: new [agents] overrides legacy [subagents]', async () => {
      // enabled: new wins (true). include_in_rules: only legacy provides it (true).
      const content =
        '[agents]\nenabled = true\n\n[subagents]\nenabled = false\ninclude_in_rules = true\n';
      await fs.writeFile(path.join(rulerDir, 'ruler.toml'), content);
      const config = await loadConfig({ projectRoot: tmpDir });
      expect(config.subagents?.enabled).toBe(true);
      expect(config.subagents?.include_in_rules).toBe(true);
    });

    it('leaves subagents config empty when neither section sets the keys', async () => {
      const content = '[agents.claude]\nenabled = false\n';
      await fs.writeFile(path.join(rulerDir, 'ruler.toml'), content);
      const config = await loadConfig({ projectRoot: tmpDir });
      expect(config.subagents?.enabled).toBeUndefined();
      expect(config.subagents?.include_in_rules).toBeUndefined();
    });

    it('rejects [agents] enabled when value is not a boolean (Zod validation)', async () => {
      const content = '[agents]\nenabled = "yes"\n';
      await fs.writeFile(path.join(rulerDir, 'ruler.toml'), content);
      await expect(loadConfig({ projectRoot: tmpDir })).rejects.toThrow(
        /Invalid configuration/i,
      );
    });

    it('rejects [agents] include_in_rules when value is not a boolean', async () => {
      const content = '[agents]\ninclude_in_rules = 1\n';
      await fs.writeFile(path.join(rulerDir, 'ruler.toml'), content);
      await expect(loadConfig({ projectRoot: tmpDir })).rejects.toThrow(
        /Invalid configuration/i,
      );
    });

    it('honors legacy [subagents] include_in_rules even when [agents] is absent', async () => {
      const content = '[subagents]\ninclude_in_rules = true\n';
      await fs.writeFile(path.join(rulerDir, 'ruler.toml'), content);
      const config = await loadConfig({ projectRoot: tmpDir });
      expect(config.subagents?.include_in_rules).toBe(true);
      expect(config.subagents?.enabled).toBeUndefined();
    });

    it('treats [agents] with only per-agent records as no subagent config', async () => {
      const content =
        '[agents.claude]\nenabled = true\n[agents.cursor]\nenabled = false\n';
      await fs.writeFile(path.join(rulerDir, 'ruler.toml'), content);
      const config = await loadConfig({ projectRoot: tmpDir });
      expect(config.subagents?.enabled).toBeUndefined();
      expect(config.agentConfigs.claude.enabled).toBe(true);
      expect(config.agentConfigs.cursor.enabled).toBe(false);
    });

    // Spec test #8: unknown scalar keys under [agents] are neither reserved
    // global fields nor per-agent objects, so they must fail with an
    // actionable error that names the offending path.
    it('rejects unknown scalar keys under [agents] with an actionable error', async () => {
      const content = '[agents]\nfoo = true\n';
      await fs.writeFile(path.join(rulerDir, 'ruler.toml'), content);
      try {
        await loadConfig({ projectRoot: tmpDir });
        throw new Error('expected loadConfig to throw');
      } catch (err) {
        const message = (err as Error).message;
        expect(message).toMatch(/Invalid configuration/i);
        expect(message).toContain('agents.foo');
      }
    });

    // Independence per spec: global `[agents].enabled` controls native
    // subagent propagation only; `[agents.<name>].enabled` controls
    // top-level output for that coding-agent integration. Neither should
    // override the other.
    it('keeps global [agents].enabled independent of per-agent enabled (off + on)', async () => {
      const content =
        '[agents]\nenabled = false\n\n[agents.claude]\nenabled = true\noutput_path = "CLAUDE.md"\n';
      await fs.writeFile(path.join(rulerDir, 'ruler.toml'), content);
      const config = await loadConfig({ projectRoot: tmpDir });
      expect(config.subagents?.enabled).toBe(false);
      expect(config.agentConfigs.claude.enabled).toBe(true);
    });

    it('keeps global [agents].enabled independent of per-agent enabled (on + off)', async () => {
      const content =
        '[agents]\nenabled = true\n\n[agents.claude]\nenabled = false\n';
      await fs.writeFile(path.join(rulerDir, 'ruler.toml'), content);
      const config = await loadConfig({ projectRoot: tmpDir });
      expect(config.subagents?.enabled).toBe(true);
      expect(config.agentConfigs.claude.enabled).toBe(false);
    });
  });
});
