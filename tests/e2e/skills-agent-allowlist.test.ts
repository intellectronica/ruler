import { execFileSync } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

describe('Skills allowlist CLI', () => {
  let root: string;
  let rulerDir: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-skills-allowlist-'));
    rulerDir = path.join(root, '.ruler');
    const source = path.join(rulerDir, 'skills', 'example');
    await fs.mkdir(source, { recursive: true });
    await fs.writeFile(path.join(source, 'SKILL.md'), '# Example skill');
    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), '# Rules');
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  function apply(...flags: string[]): void {
    execFileSync(process.execPath, [
      path.resolve('dist/cli/index.js'),
      'apply',
      '--project-root',
      root,
      '--no-mcp',
      '--local-only',
      '--gitignore',
      ...flags,
    ]);
  }

  it('updates managed skills and ignore entries while keeping rules and personal skills', async () => {
    const config = path.join(rulerDir, 'ruler.toml');
    const defaults = 'default_agents = ["claude", "goose", "codex"]\n';
    const claudeSkills = path.join(root, '.claude', 'skills');
    const claudeSkill = path.join(claudeSkills, 'example', 'SKILL.md');
    const sharedSkill = path.join(
      root,
      '.agents',
      'skills',
      'example',
      'SKILL.md',
    );

    await fs.writeFile(config, defaults);
    apply();
    await expect(fs.readFile(claudeSkill, 'utf8')).resolves.toBe(
      '# Example skill',
    );
    await fs.writeFile(path.join(claudeSkills, 'personal.md'), '# Personal');

    await fs.writeFile(
      config,
      defaults +
        '[skills]\nenabled = false\nallowed_agents = ["goose", "cursor"]\n',
    );
    apply('--skills');
    await expect(fs.readFile(sharedSkill, 'utf8')).resolves.toBe(
      '# Example skill',
    );
    await expect(fs.access(claudeSkill)).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(
      fs.access(path.join(root, '.cursor', 'skills')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(
      fs.readFile(path.join(claudeSkills, 'personal.md'), 'utf8'),
    ).resolves.toBe('# Personal');
    await expect(
      fs.readFile(path.join(root, 'CLAUDE.md'), 'utf8'),
    ).resolves.toContain('# Rules');
    const ignore = await fs.readFile(path.join(root, '.gitignore'), 'utf8');
    expect(ignore).toContain('.agents/skills/example');
    expect(ignore).not.toContain('.claude/skills/example');

    apply('--skills', '--agents', 'claude');
    await expect(fs.readFile(sharedSkill, 'utf8')).resolves.toBe(
      '# Example skill',
    );

    await fs.writeFile(config, defaults + '[skills]\nallowed_agents = []\n');
    apply();
    await expect(fs.access(sharedSkill)).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});
