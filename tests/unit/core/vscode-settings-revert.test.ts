import { promises as fs } from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { revertAllAgentConfigs } from '../../../src/revert';
import {
  getVSCodeSettingsPath,
  mergeAugmentMcpServers,
  readVSCodeSettings,
  transformRulerToAugmentMcp,
  writeVSCodeSettings,
} from '../../../src/vscode/settings';

describe('VSCode settings utilities', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(
      path.join(tmpdir(), 'ruler-vscode-settings-utils-'),
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('returns empty settings when settings.json does not exist', async () => {
    await expect(
      readVSCodeSettings(path.join(tempDir, '.vscode', 'settings.json')),
    ).resolves.toEqual({});
  });

  it('rethrows invalid settings.json errors', async () => {
    const settingsPath = path.join(tempDir, '.vscode', 'settings.json');
    await fs.mkdir(path.dirname(settingsPath), { recursive: true });
    await fs.writeFile(settingsPath, '{not-json');

    await expect(readVSCodeSettings(settingsPath)).rejects.toThrow();
  });

  it('writes formatted settings and creates parent directories', async () => {
    const settingsPath = path.join(tempDir, '.vscode', 'settings.json');

    await writeVSCodeSettings(settingsPath, {
      'editor.tabSize': 2,
      'augment.advanced': {
        mcpServers: [{ name: 'filesystem', command: 'npx' }],
      },
    });

    const raw = await fs.readFile(settingsPath, 'utf8');
    expect(raw).toContain('\n    "editor.tabSize": 2,');
    expect(JSON.parse(raw)).toEqual({
      'editor.tabSize': 2,
      'augment.advanced': {
        mcpServers: [{ name: 'filesystem', command: 'npx' }],
      },
    });
  });

  it('transforms ruler MCP servers to Augment server arrays', () => {
    expect(
      transformRulerToAugmentMcp({
        mcpServers: {
          filesystem: {
            command: 'npx',
            args: ['-y', 'server-filesystem'],
            env: { DEBUG: '1' },
          },
          plain: { command: 'node' },
        },
      }),
    ).toEqual([
      {
        name: 'filesystem',
        command: 'npx',
        args: ['-y', 'server-filesystem'],
        env: { DEBUG: '1' },
      },
      { name: 'plain', command: 'node' },
    ]);
  });

  it('returns no Augment servers when ruler MCP config is absent', () => {
    expect(transformRulerToAugmentMcp({})).toEqual([]);
    expect(transformRulerToAugmentMcp({ mcpServers: null })).toEqual([]);
  });

  it('merges Augment MCP servers by name while preserving other settings', () => {
    const merged = mergeAugmentMcpServers(
      {
        'editor.fontSize': 14,
        'augment.advanced': {
          custom: true,
          mcpServers: [
            { name: 'existing', command: 'old' },
            { name: 'keep', command: 'keep-command' },
          ],
        },
      },
      [
        { name: 'existing', command: 'new' },
        { name: 'added', command: 'added-command' },
      ],
      'merge',
    );

    expect(merged).toEqual({
      'editor.fontSize': 14,
      'augment.advanced': {
        custom: true,
        mcpServers: [
          { name: 'existing', command: 'new' },
          { name: 'keep', command: 'keep-command' },
          { name: 'added', command: 'added-command' },
        ],
      },
    });
  });

  it('overwrites Augment MCP servers without removing unrelated settings', () => {
    const overwritten = mergeAugmentMcpServers(
      {
        'editor.fontSize': 14,
        'augment.advanced': {
          custom: true,
          mcpServers: [{ name: 'existing', command: 'old' }],
        },
      },
      [{ name: 'replacement', command: 'new' }],
      'overwrite',
    );

    expect(overwritten).toEqual({
      'editor.fontSize': 14,
      'augment.advanced': {
        custom: true,
        mcpServers: [{ name: 'replacement', command: 'new' }],
      },
    });
  });

  it('creates augment.advanced when merging into plain settings', () => {
    expect(
      mergeAugmentMcpServers(
        { 'editor.fontSize': 14 },
        [{ name: 'added', command: 'server' }],
        'merge',
      ),
    ).toEqual({
      'editor.fontSize': 14,
      'augment.advanced': {
        mcpServers: [{ name: 'added', command: 'server' }],
      },
    });
  });

  it('returns the project-local VSCode settings path', () => {
    expect(getVSCodeSettingsPath('/repo')).toBe(
      path.join('/repo', '.vscode', 'settings.json'),
    );
  });
});

describe('VSCode Settings Revert', () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(
      path.join(tmpdir(), 'ruler-vscode-settings-test-'),
    );
    projectRoot = tempDir;

    // Create .ruler directory
    await fs.mkdir(path.join(projectRoot, '.ruler'), { recursive: true });

    // Create a minimal ruler.config.json
    const configPath = path.join(projectRoot, '.ruler', 'ruler.config.json');
    await fs.writeFile(
      configPath,
      JSON.stringify({
        defaultAgents: ['augmentcode'],
        agentConfigs: {
          augmentcode: {
            enabled: true,
          },
        },
      }),
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should preserve existing VSCode settings when reverting', async () => {
    // Create .vscode directory and settings.json with existing user settings
    const vscodeDir = path.join(projectRoot, '.vscode');
    await fs.mkdir(vscodeDir, { recursive: true });

    const settingsPath = getVSCodeSettingsPath(projectRoot);
    const originalSettings = {
      'editor.fontSize': 14,
      'editor.tabSize': 2,
      'files.autoSave': 'afterDelay',
      'augment.advanced': {
        mcpServers: [{ name: 'test-server', command: 'test' }],
      },
    };

    await writeVSCodeSettings(settingsPath, originalSettings);

    // Run revert
    await revertAllAgentConfigs(
      projectRoot,
      undefined,
      undefined,
      false,
      true,
      false,
      true,
    );

    // Check that user settings are preserved but augment.advanced is removed
    const resultSettings = await readVSCodeSettings(settingsPath);

    expect(resultSettings).toEqual({
      'editor.fontSize': 14,
      'editor.tabSize': 2,
      'files.autoSave': 'afterDelay',
    });

    expect(resultSettings['augment.advanced']).toBeUndefined();
  });

  it('should restore from backup when backup exists', async () => {
    // Create .vscode directory
    const vscodeDir = path.join(projectRoot, '.vscode');
    await fs.mkdir(vscodeDir, { recursive: true });

    const settingsPath = getVSCodeSettingsPath(projectRoot);
    const backupPath = `${settingsPath}.bak`;

    // Create backup with original settings
    const originalSettings = {
      'editor.fontSize': 16,
      'workbench.colorTheme': 'Dark+',
    };
    await writeVSCodeSettings(backupPath, originalSettings);

    // Create current settings with ruler modifications
    const currentSettings = {
      'editor.fontSize': 16,
      'workbench.colorTheme': 'Dark+',
      'augment.advanced': {
        mcpServers: [{ name: 'test-server', command: 'test' }],
      },
    };
    await writeVSCodeSettings(settingsPath, currentSettings);

    // Run revert
    await revertAllAgentConfigs(
      projectRoot,
      undefined,
      undefined,
      false,
      false,
      false,
      true,
    );

    // Check that original settings are restored
    const resultSettings = await readVSCodeSettings(settingsPath);

    expect(resultSettings).toEqual(originalSettings);
    expect(resultSettings['augment.advanced']).toBeUndefined();
  });

  it('should handle missing settings.json gracefully', async () => {
    // Create .vscode directory but no settings.json
    const vscodeDir = path.join(projectRoot, '.vscode');
    await fs.mkdir(vscodeDir, { recursive: true });

    // Run revert (should not throw error)
    await expect(
      revertAllAgentConfigs(
        projectRoot,
        undefined,
        undefined,
        false,
        false,
        false,
        true,
      ),
    ).resolves.not.toThrow();
  });

  it('should handle settings.json without augment.advanced gracefully', async () => {
    // Create .vscode directory and settings.json without augment.advanced
    const vscodeDir = path.join(projectRoot, '.vscode');
    await fs.mkdir(vscodeDir, { recursive: true });

    const settingsPath = getVSCodeSettingsPath(projectRoot);
    const userSettings = {
      'editor.fontSize': 14,
      'editor.tabSize': 2,
    };

    await writeVSCodeSettings(settingsPath, userSettings);

    // Run revert
    await revertAllAgentConfigs(
      projectRoot,
      undefined,
      undefined,
      false,
      false,
      false,
      true,
    );

    // Check that user settings are unchanged
    const resultSettings = await readVSCodeSettings(settingsPath);

    expect(resultSettings).toEqual(userSettings);
  });
});
