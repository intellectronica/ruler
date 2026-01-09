import * as fs from 'fs/promises';
import * as path from 'path';
import { applyAllAgentConfigs } from '../src/lib';
import { setupTestProject, teardownTestProject } from './harness';

describe('Claude hooks support', () => {
  let projectRoot: string | undefined;

  afterEach(async () => {
    if (projectRoot) {
      await teardownTestProject(projectRoot);
    }
  });

  it('merges hooks into .claude/settings.json', async () => {
    const { projectRoot: root } = await setupTestProject({
      '.ruler/AGENTS.md': '# Rules',
      '.ruler/ruler.toml': `
[agents.claude.hooks]
enabled = true
merge_strategy = "merge"
source = ".ruler/hooks/claude.json"
`,
      '.ruler/hooks/claude.json': JSON.stringify(
        {
          hooks: {
            PostToolUse: [
              {
                matcher: 'bash',
                hooks: [{ type: 'command', command: 'echo new' }],
              },
            ],
            Stop: [{ hooks: [{ type: 'command', command: 'echo stop' }] }],
          },
        },
        null,
        2,
      ),
      '.claude/settings.json': JSON.stringify(
        {
          theme: 'dark',
          hooks: {
            PostToolUse: [
              {
                matcher: 'bash',
                hooks: [{ type: 'command', command: 'echo existing' }],
              },
            ],
          },
        },
        null,
        2,
      ),
    });

    projectRoot = root;

    await applyAllAgentConfigs(
      projectRoot,
      ['claude'],
      undefined,
      true,
      undefined,
      undefined,
      false,
      false,
      false,
      false,
      false,
      false,
    );

    const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
    const settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'));

    expect(settings.theme).toBe('dark');
    expect(settings.hooks.PostToolUse).toHaveLength(2);
    expect(settings.hooks.Stop).toHaveLength(1);
  });

  it('overwrites hooks when merge_strategy is overwrite', async () => {
    const { projectRoot: root } = await setupTestProject({
      '.ruler/AGENTS.md': '# Rules',
      '.ruler/ruler.toml': `
[agents.claude.hooks]
enabled = true
merge_strategy = "overwrite"
source = ".ruler/hooks/claude.json"
`,
      '.ruler/hooks/claude.json': JSON.stringify(
        {
          hooks: {
            PostToolUse: [
              {
                matcher: 'bash',
                hooks: [{ type: 'command', command: 'echo new' }],
              },
            ],
          },
        },
        null,
        2,
      ),
      '.claude/settings.json': JSON.stringify(
        {
          theme: 'light',
          hooks: {
            PostToolUse: [
              {
                matcher: 'bash',
                hooks: [{ type: 'command', command: 'echo old' }],
              },
            ],
            Stop: [{ hooks: [{ type: 'command', command: 'echo stop' }] }],
          },
        },
        null,
        2,
      ),
    });

    projectRoot = root;

    await applyAllAgentConfigs(
      projectRoot,
      ['claude'],
      undefined,
      true,
      undefined,
      undefined,
      false,
      false,
      false,
      false,
      false,
      false,
    );

    const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
    const settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'));

    expect(settings.theme).toBe('light');
    expect(settings.hooks.PostToolUse).toHaveLength(1);
    expect(settings.hooks.Stop).toBeUndefined();
  });
});
