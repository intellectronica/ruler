import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { applyAllAgentConfigs } from '../../src/lib';

describe('Folder Propagation', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ruler-folder-test-'),
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('propagates listed folders and concatenates root files when enabled', async () => {
    // Setup .ruler directory
    const rulerDir = path.join(tmpDir, '.ruler');
    const promptsDir = path.join(rulerDir, 'prompts');

    await fs.mkdir(promptsDir, { recursive: true });
    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), '# Root Rules');
    await fs.writeFile(path.join(rulerDir, 'style.md'), '## Style Guide');
    await fs.writeFile(path.join(promptsDir, 'intro.md'), '# Prompt Intro');
    await fs.writeFile(path.join(promptsDir, 'review.md'), '# Code Review');

    // Create ruler.toml with folders enabled
    await fs.writeFile(
      path.join(rulerDir, 'ruler.toml'),
      `
[folders]
enabled = true
skip_unmapped = false

[folders.agents.claude]
prompts = ".claude/prompts"
`,
    );

    await applyAllAgentConfigs(
      tmpDir,
      ['claude'],
      undefined,
      true,
      undefined,
      undefined,
      false,
      false,
      false,
      false,
      true,
      undefined,
      undefined,
      undefined, // foldersEnabled → undefined, rely on config
    );

    // Root files should still be concatenated into CLAUDE.md
    const claudeMd = await fs.readFile(path.join(tmpDir, 'CLAUDE.md'), 'utf8');
    expect(claudeMd).toContain('# Root Rules');
    expect(claudeMd).toContain('## Style Guide');
    // Propagated folder files should NOT be in CLAUDE.md
    expect(claudeMd).not.toContain('# Prompt Intro');
    expect(claudeMd).not.toContain('# Code Review');

    // Propagated folder should exist at target
    const promptsTarget = path.join(tmpDir, '.claude', 'prompts');
    const introContent = await fs.readFile(
      path.join(promptsTarget, 'intro.md'),
      'utf8',
    );
    expect(introContent).toBe('# Prompt Intro');
    const reviewContent = await fs.readFile(
      path.join(promptsTarget, 'review.md'),
      'utf8',
    );
    expect(reviewContent).toBe('# Code Review');
  });

  it('skips unlisted subdirs when skip_unmapped is true', async () => {
    const rulerDir = path.join(tmpDir, '.ruler');

    await fs.mkdir(path.join(rulerDir, 'prompts'), { recursive: true });
    await fs.mkdir(path.join(rulerDir, 'tools'), { recursive: true });
    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), '# Root');
    await fs.writeFile(path.join(rulerDir, 'prompts', 'intro.md'), '# Intro');
    await fs.writeFile(path.join(rulerDir, 'tools', 'linter.md'), '# Linter');

    await fs.writeFile(
      path.join(rulerDir, 'ruler.toml'),
      `
[folders]
enabled = true
skip_unmapped = true

[folders.agents.claude]
prompts = ".claude/prompts"
`,
    );

    await applyAllAgentConfigs(
      tmpDir,
      ['claude'],
      undefined,
      true,
      undefined,
      undefined,
      false,
      false,
      false,
      false,
      true,
      undefined,
      undefined,
      undefined,
    );

    const claudeMd = await fs.readFile(path.join(tmpDir, 'CLAUDE.md'), 'utf8');
    // Root file is still concatenated
    expect(claudeMd).toContain('# Root');
    // Propagated folder is not in CLAUDE.md
    expect(claudeMd).not.toContain('# Intro');
    // Unlisted tools dir is also NOT in CLAUDE.md (skip_unmapped = true)
    expect(claudeMd).not.toContain('# Linter');

    // Propagated folder exists
    const promptsTarget = path.join(tmpDir, '.claude', 'prompts');
    expect(
      await fs.readFile(path.join(promptsTarget, 'intro.md'), 'utf8'),
    ).toBe('# Intro');

    // Unlisted tools dir was NOT propagated
    const toolsTarget = path.join(tmpDir, '.claude', 'tools');
    await expect(fs.access(toolsTarget)).rejects.toThrow();
  });

  it('concatenates unlisted subdirs by default when skip_unmapped is false', async () => {
    const rulerDir = path.join(tmpDir, '.ruler');

    await fs.mkdir(path.join(rulerDir, 'prompts'), { recursive: true });
    await fs.mkdir(path.join(rulerDir, 'tools'), { recursive: true });
    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), '# Root');
    await fs.writeFile(path.join(rulerDir, 'prompts', 'intro.md'), '# Intro');
    await fs.writeFile(path.join(rulerDir, 'tools', 'linter.md'), '# Linter');

    await fs.writeFile(
      path.join(rulerDir, 'ruler.toml'),
      `
[folders]
enabled = true
skip_unmapped = false

[folders.agents.claude]
prompts = ".claude/prompts"
`,
    );

    await applyAllAgentConfigs(
      tmpDir,
      ['claude'],
      undefined,
      true,
      undefined,
      undefined,
      false,
      false,
      false,
      false,
      true,
      undefined,
      undefined,
      undefined,
    );

    const claudeMd = await fs.readFile(path.join(tmpDir, 'CLAUDE.md'), 'utf8');
    // Root file is still concatenated
    expect(claudeMd).toContain('# Root');
    // Propagated folder is NOT in CLAUDE.md
    expect(claudeMd).not.toContain('# Intro');
    // Unlisted tools dir IS concatenated (skip_unmapped = false)
    expect(claudeMd).toContain('# Linter');

    // Propagated folder exists
    const promptsTarget = path.join(tmpDir, '.claude', 'prompts');
    expect(
      await fs.readFile(path.join(promptsTarget, 'intro.md'), 'utf8'),
    ).toBe('# Intro');
  });

  it('does not propagate when folders is disabled', async () => {
    const rulerDir = path.join(tmpDir, '.ruler');

    await fs.mkdir(path.join(rulerDir, 'prompts'), { recursive: true });
    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), '# Root');
    await fs.writeFile(path.join(rulerDir, 'prompts', 'intro.md'), '# Intro');

    await fs.writeFile(
      path.join(rulerDir, 'ruler.toml'),
      `
[folders]
enabled = false

[folders.agents.claude]
prompts = ".claude/prompts"
`,
    );

    await applyAllAgentConfigs(
      tmpDir,
      ['claude'],
      undefined,
      true,
      undefined,
      undefined,
      false,
      false,
      false,
      false,
      true,
      undefined,
      undefined,
      undefined,
    );

    // Everything is concatenated as normal
    const claudeMd = await fs.readFile(path.join(tmpDir, 'CLAUDE.md'), 'utf8');
    expect(claudeMd).toContain('# Root');
    expect(claudeMd).toContain('# Intro');

    // No propagated folder
    const promptsTarget = path.join(tmpDir, '.claude', 'prompts');
    await expect(fs.access(promptsTarget)).rejects.toThrow();
  });

  it('only propagates to selected agents', async () => {
    const rulerDir = path.join(tmpDir, '.ruler');

    await fs.mkdir(path.join(rulerDir, 'prompts'), { recursive: true });
    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), '# Root');
    await fs.writeFile(path.join(rulerDir, 'prompts', 'intro.md'), '# Intro');

    await fs.writeFile(
      path.join(rulerDir, 'ruler.toml'),
      `
[folders]
enabled = true

[folders.agents.claude]
prompts = ".claude/prompts"

[folders.agents.cursor]
prompts = ".cursor/prompts"
`,
    );

    // Only apply for claude, not cursor
    await applyAllAgentConfigs(
      tmpDir,
      ['claude'],
      undefined,
      true,
      undefined,
      undefined,
      false,
      false,
      false,
      false,
      true,
      undefined,
      undefined,
      undefined,
    );

    // Claude should have the propagated folder
    const claudeTarget = path.join(tmpDir, '.claude', 'prompts');
    expect(await fs.readFile(path.join(claudeTarget, 'intro.md'), 'utf8')).toBe(
      '# Intro',
    );

    // Cursor should NOT have the propagated folder (not selected)
    const cursorTarget = path.join(tmpDir, '.cursor', 'prompts');
    await expect(fs.access(cursorTarget)).rejects.toThrow();
  });

  it('cleans up propagated folders when disabled after being enabled', async () => {
    const rulerDir = path.join(tmpDir, '.ruler');

    await fs.mkdir(path.join(rulerDir, 'prompts'), { recursive: true });
    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), '# Root');
    await fs.writeFile(path.join(rulerDir, 'prompts', 'intro.md'), '# Intro');

    // First apply with folders enabled
    await fs.writeFile(
      path.join(rulerDir, 'ruler.toml'),
      `
[folders]
enabled = true

[folders.agents.claude]
prompts = ".claude/prompts"
`,
    );

    await applyAllAgentConfigs(
      tmpDir,
      ['claude'],
      undefined,
      true,
      undefined,
      undefined,
      false,
      false,
      false,
      false,
      true,
      undefined,
      undefined,
      undefined,
    );

    // Verify folder was propagated
    const promptsTarget = path.join(tmpDir, '.claude', 'prompts');
    expect(
      await fs.readFile(path.join(promptsTarget, 'intro.md'), 'utf8'),
    ).toBe('# Intro');

    // Now disable folders
    await fs.writeFile(
      path.join(rulerDir, 'ruler.toml'),
      `
[folders]
enabled = false

[folders.agents.claude]
prompts = ".claude/prompts"
`,
    );

    await applyAllAgentConfigs(
      tmpDir,
      ['claude'],
      undefined,
      true,
      undefined,
      undefined,
      false,
      false,
      false,
      false,
      true,
      undefined,
      undefined,
      undefined,
    );

    // Propagated folder should be cleaned up
    await expect(fs.access(promptsTarget)).rejects.toThrow();

    // Files should be concatenated again
    const claudeMd = await fs.readFile(path.join(tmpDir, 'CLAUDE.md'), 'utf8');
    expect(claudeMd).toContain('# Intro');
  });

  it('CLI --folders flag overrides TOML config', async () => {
    const rulerDir = path.join(tmpDir, '.ruler');

    await fs.mkdir(path.join(rulerDir, 'prompts'), { recursive: true });
    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), '# Root');

    await fs.writeFile(path.join(rulerDir, 'prompts', 'intro.md'), '# Intro');

    // TOML says disabled
    await fs.writeFile(
      path.join(rulerDir, 'ruler.toml'),
      `
[folders]
enabled = false

[folders.agents.claude]
prompts = ".claude/prompts"
`,
    );

    // CLI flag says enabled (overrides TOML)
    await applyAllAgentConfigs(
      tmpDir,
      ['claude'],
      undefined,
      true,
      undefined,
      undefined,
      false,
      false,
      false,
      false,
      true,
      undefined,
      undefined,
      undefined,
      true, // foldersEnabled = true
    );

    // Folder should be propagated because CLI overrides TOML
    const promptsTarget = path.join(tmpDir, '.claude', 'prompts');
    expect(
      await fs.readFile(path.join(promptsTarget, 'intro.md'), 'utf8'),
    ).toBe('# Intro');
  });
});
