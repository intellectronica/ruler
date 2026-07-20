import * as fs from 'fs/promises';
import * as path from 'path';
import { runRuler, setupTestProject, teardownTestProject } from '../harness';

describe('settings sidecar safety', () => {
  it.each([
    {
      agent: 'gemini-cli',
      settingsPath: path.join('.gemini', 'settings.json'),
    },
    {
      agent: 'qwen',
      settingsPath: path.join('.qwen', 'settings.json'),
    },
  ])(
    'backs up and restores existing $agent settings',
    async ({ agent, settingsPath }) => {
      const originalSettings = JSON.stringify(
        { theme: 'dark', contextFileName: 'USER.md' },
        null,
        2,
      );
      const project = await setupTestProject({
        '.ruler/AGENTS.md': 'Rule A',
        [settingsPath]: originalSettings,
      });
      const fullSettingsPath = path.join(project.projectRoot, settingsPath);

      try {
        runRuler(`apply --agents ${agent} --no-mcp`, project.projectRoot);

        await expect(
          fs.readFile(`${fullSettingsPath}.bak`, 'utf8'),
        ).resolves.toBe(originalSettings);
        await expect(fs.readFile(fullSettingsPath, 'utf8')).resolves.not.toBe(
          originalSettings,
        );

        runRuler(`revert --agents ${agent}`, project.projectRoot);

        await expect(fs.readFile(fullSettingsPath, 'utf8')).resolves.toBe(
          originalSettings,
        );
        await expect(fs.access(`${fullSettingsPath}.bak`)).rejects.toThrow();
      } finally {
        await teardownTestProject(project.projectRoot);
      }
    },
  );

  it('honours Qwen output_path_config for settings writes', async () => {
    const project = await setupTestProject({
      '.ruler/AGENTS.md': 'Rule A',
      '.ruler/ruler.toml': [
        '[agents.qwen]',
        'output_path_config = "custom/qwen-settings.json"',
        '',
      ].join('\n'),
    });
    const customSettingsPath = path.join(
      project.projectRoot,
      'custom',
      'qwen-settings.json',
    );
    const defaultSettingsPath = path.join(
      project.projectRoot,
      '.qwen',
      'settings.json',
    );

    try {
      runRuler('apply --agents qwen --no-mcp', project.projectRoot);

      const raw = await fs.readFile(customSettingsPath, 'utf8');
      expect(JSON.parse(raw).contextFileName).toBe('AGENTS.md');
      await expect(fs.access(defaultSettingsPath)).rejects.toThrow();
    } finally {
      await teardownTestProject(project.projectRoot);
    }
  });

  it('backs up and restores existing Zed settings when MCP settings change', async () => {
    const originalSettings = JSON.stringify(
      {
        theme: 'dark',
        context_servers: {
          local: {
            source: 'custom',
            command: 'local-server',
          },
        },
      },
      null,
      2,
    );
    const project = await setupTestProject({
      '.ruler/AGENTS.md': 'Rule A',
      '.ruler/mcp.json': JSON.stringify({
        mcpServers: {
          generated: {
            type: 'stdio',
            command: 'node',
            args: ['server.js'],
          },
        },
      }),
      '.zed/settings.json': originalSettings,
    });
    const settingsPath = path.join(
      project.projectRoot,
      '.zed',
      'settings.json',
    );

    try {
      runRuler('apply --agents zed', project.projectRoot);

      await expect(fs.readFile(`${settingsPath}.bak`, 'utf8')).resolves.toBe(
        originalSettings,
      );
      await expect(fs.readFile(settingsPath, 'utf8')).resolves.not.toBe(
        originalSettings,
      );

      runRuler('revert --agents zed', project.projectRoot);

      await expect(fs.readFile(settingsPath, 'utf8')).resolves.toBe(
        originalSettings,
      );
      await expect(fs.access(`${settingsPath}.bak`)).rejects.toThrow();
    } finally {
      await teardownTestProject(project.projectRoot);
    }
  });

  it('tracks generated Gemini and Qwen settings in gitignore without MCP', async () => {
    const project = await setupTestProject({
      '.ruler/AGENTS.md': 'Rule A',
    });

    try {
      runRuler('apply --agents gemini-cli,qwen --no-mcp', project.projectRoot);

      const gitignore = await fs.readFile(
        path.join(project.projectRoot, '.gitignore'),
        'utf8',
      );

      expect(gitignore).toContain('/.gemini/settings.json');
      expect(gitignore).toContain('/.qwen/settings.json');
    } finally {
      await teardownTestProject(project.projectRoot);
    }
  });
});
