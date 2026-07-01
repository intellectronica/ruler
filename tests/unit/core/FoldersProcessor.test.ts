import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import {
  getFolderSkipDirectories,
  getFolderSkipUnmapped,
  getFoldersGitignorePaths,
  propagateFolders,
} from '../../../src/core/FoldersProcessor';
import { ClaudeAgent } from '../../../src/agents/ClaudeAgent';
import { CursorAgent } from '../../../src/agents/CursorAgent';
import type { FoldersConfig } from '../../../src/types';

describe('getFolderSkipDirectories', () => {
  it('returns empty array when folders is undefined', () => {
    expect(getFolderSkipDirectories(undefined)).toEqual([]);
  });

  it('returns empty array when folders.enabled is false', () => {
    expect(getFolderSkipDirectories({ enabled: false })).toEqual([]);
  });

  it('returns empty array when folders.agents is empty', () => {
    expect(
      getFolderSkipDirectories({ enabled: true, agents: {} }),
    ).toEqual([]);
  });

  it('returns collected source directory names from agent mappings', () => {
    const config: FoldersConfig = {
      enabled: true,
      agents: {
        claude: { prompts: '.claude/prompts', templates: '.claude/templates' },
        cursor: { prompts: '.cursor/prompts' },
      },
    };
    const result = getFolderSkipDirectories(config);
    expect(result.sort()).toEqual(['prompts', 'templates']);
  });

  it('deduplicates when same source is mapped for multiple agents', () => {
    const config: FoldersConfig = {
      enabled: true,
      agents: {
        claude: { prompts: '.claude/prompts' },
        cursor: { prompts: '.cursor/prompts' },
      },
    };
    const result = getFolderSkipDirectories(config);
    expect(result).toEqual(['prompts']);
  });
});

describe('getFolderSkipUnmapped', () => {
  it('returns false when folders is undefined', () => {
    expect(getFolderSkipUnmapped(undefined)).toBe(false);
  });

  it('returns false when folders.enabled is false', () => {
    expect(getFolderSkipUnmapped({ enabled: false })).toBe(false);
  });

  it('returns true only when both enabled and skip_unmapped are true', () => {
    expect(
      getFolderSkipUnmapped({ enabled: true, skip_unmapped: true }),
    ).toBe(true);
  });

  it('returns false when enabled is true but skip_unmapped is missing', () => {
    expect(getFolderSkipUnmapped({ enabled: true })).toBe(false);
  });

  it('returns false when enabled is true but skip_unmapped is false', () => {
    expect(
      getFolderSkipUnmapped({ enabled: true, skip_unmapped: false }),
    ).toBe(false);
  });
});

describe('getFoldersGitignorePaths', () => {
  it('returns empty array when folders is undefined', async () => {
    const result = await getFoldersGitignorePaths(
      '/root',
      [new ClaudeAgent()],
      undefined,
    );
    expect(result).toEqual([]);
  });

  it('returns empty array when folders.enabled is false', async () => {
    const result = await getFoldersGitignorePaths(
      '/root',
      [new ClaudeAgent()],
      { enabled: false },
    );
    expect(result).toEqual([]);
  });

  it('returns empty array when folders.agents is empty', async () => {
    const result = await getFoldersGitignorePaths(
      '/root',
      [new ClaudeAgent()],
      { enabled: true, agents: {} },
    );
    expect(result).toEqual([]);
  });

  it('only includes paths for selected agents', async () => {
    const config: FoldersConfig = {
      enabled: true,
      agents: {
        claude: { prompts: '.claude/prompts' },
        cursor: { prompts: '.cursor/prompts' },
      },
    };
    const result = await getFoldersGitignorePaths(
      '/root',
      [new ClaudeAgent()],
      config,
    );
    expect(result).toEqual(['.claude/prompts']);
  });

  it('returns normalized relative paths with forward slashes', async () => {
    const config: FoldersConfig = {
      enabled: true,
      agents: {
        claude: { prompts: '.claude/prompts' },
      },
    };
    const result = await getFoldersGitignorePaths(
      '/root',
      [new ClaudeAgent()],
      config,
    );
    expect(result).toEqual(['.claude/prompts']);
  });

  it('includes paths for all selected agents', async () => {
    const config: FoldersConfig = {
      enabled: true,
      agents: {
        claude: { prompts: '.claude/prompts' },
        cursor: { prompts: '.cursor/prompts' },
      },
    };
    const result = await getFoldersGitignorePaths(
      '/root',
      [new ClaudeAgent(), new CursorAgent()],
      config,
    );
    expect(result.sort()).toEqual(['.claude/prompts', '.cursor/prompts']);
  });
});

describe('propagateFolders — dry-run', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-folder-dry-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('does not create target directories in dry-run mode', async () => {
    const rulerDir = path.join(tmpDir, '.ruler');
    const promptsDir = path.join(rulerDir, 'prompts');
    await fs.mkdir(promptsDir, { recursive: true });
    await fs.writeFile(path.join(promptsDir, 'intro.md'), '# Intro');

    const config: FoldersConfig = {
      enabled: true,
      agents: {
        claude: { prompts: '.claude/prompts' },
      },
    };

    const { generatedPaths } = await propagateFolders(
      tmpDir,
      [new ClaudeAgent()],
      config,
      false,
      true,
    );

    const targetDir = path.join(tmpDir, '.claude', 'prompts');
    await expect(fs.access(targetDir)).rejects.toThrow();
    expect(generatedPaths).toEqual(['.claude/prompts']);
  });

  it('does not remove existing target directories during dry-run cleanup', async () => {
    const rulerDir = path.join(tmpDir, '.ruler');
    const promptsDir = path.join(rulerDir, 'prompts');
    await fs.mkdir(promptsDir, { recursive: true });
    await fs.writeFile(path.join(promptsDir, 'intro.md'), '# Intro');

    const enabledConfig: FoldersConfig = {
      enabled: true,
      agents: {
        claude: { prompts: '.claude/prompts' },
      },
    };

    await propagateFolders(
      tmpDir,
      [new ClaudeAgent()],
      enabledConfig,
      false,
      false,
    );

    const targetDir = path.join(tmpDir, '.claude', 'prompts');
    await expect(fs.access(targetDir)).resolves.toBeUndefined();

    const disabledConfig: FoldersConfig = {
      enabled: false,
      agents: {
        claude: { prompts: '.claude/prompts' },
      },
    };

    await propagateFolders(
      tmpDir,
      [new ClaudeAgent()],
      disabledConfig,
      false,
      true,
    );

    await expect(fs.access(targetDir)).resolves.toBeUndefined();
  });

  it('copies files when not in dry-run mode', async () => {
    const rulerDir = path.join(tmpDir, '.ruler');
    const promptsDir = path.join(rulerDir, 'prompts');
    await fs.mkdir(promptsDir, { recursive: true });
    await fs.writeFile(path.join(promptsDir, 'intro.md'), '# Intro');

    const config: FoldersConfig = {
      enabled: true,
      agents: {
        claude: { prompts: '.claude/prompts' },
      },
    };

    await propagateFolders(
      tmpDir,
      [new ClaudeAgent()],
      config,
      false,
      false,
    );

    const targetDir = path.join(tmpDir, '.claude', 'prompts');
    const content = await fs.readFile(path.join(targetDir, 'intro.md'), 'utf8');
    expect(content).toBe('# Intro');
  });
});

describe('propagateFolders — edge cases', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-folder-edge-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns early when folders is undefined', async () => {
    const { generatedPaths } = await propagateFolders(
      tmpDir,
      [new ClaudeAgent()],
      undefined,
      false,
      false,
    );
    expect(generatedPaths).toEqual([]);
  });

  it('returns early when folders.enabled is false', async () => {
    const { generatedPaths } = await propagateFolders(
      tmpDir,
      [new ClaudeAgent()],
      { enabled: false },
      false,
      false,
    );
    expect(generatedPaths).toEqual([]);
  });

  it('returns early when .ruler directory does not exist', async () => {
    const config: FoldersConfig = {
      enabled: true,
      agents: {
        claude: { prompts: '.claude/prompts' },
      },
    };
    const { generatedPaths } = await propagateFolders(
      tmpDir,
      [new ClaudeAgent()],
      config,
      false,
      false,
    );
    expect(generatedPaths).toEqual([]);
  });

  it('skips source folders that do not exist on disk', async () => {
    const rulerDir = path.join(tmpDir, '.ruler');
    await fs.mkdir(rulerDir, { recursive: true });
    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), '# Root');
    const config: FoldersConfig = {
      enabled: true,
      agents: {
        claude: { prompts: '.claude/prompts' },
      },
    };
    const { generatedPaths } = await propagateFolders(
      tmpDir,
      [new ClaudeAgent()],
      config,
      false,
      false,
    );
    expect(generatedPaths).toEqual([]);
    const targetDir = path.join(tmpDir, '.claude', 'prompts');
    await expect(fs.access(targetDir)).rejects.toThrow();
  });

  it('silently skips source symlinks during copy', async () => {
    const rulerDir = path.join(tmpDir, '.ruler');
    const promptsDir = path.join(rulerDir, 'prompts');
    await fs.mkdir(promptsDir, { recursive: true });
    await fs.writeFile(path.join(promptsDir, 'real.md'), '# Real file');

    const outsidePath = path.join(tmpDir, 'outside.txt');
    await fs.writeFile(outsidePath, 'outside content');
    try {
      await fs.symlink(outsidePath, path.join(promptsDir, 'link.md'));
    } catch {
      return;
    }

    const config: FoldersConfig = {
      enabled: true,
      agents: {
        claude: { prompts: '.claude/prompts' },
      },
    };
    await propagateFolders(
      tmpDir,
      [new ClaudeAgent()],
      config,
      false,
      false,
    );

    const targetDir = path.join(tmpDir, '.claude', 'prompts');
    const realContent = await fs.readFile(
      path.join(targetDir, 'real.md'),
      'utf8',
    );
    expect(realContent).toBe('# Real file');

    await expect(fs.access(path.join(targetDir, 'link.md'))).rejects.toThrow();
  });

  it('skips agents not in the selected list', async () => {
    const rulerDir = path.join(tmpDir, '.ruler');
    const promptsDir = path.join(rulerDir, 'prompts');
    await fs.mkdir(promptsDir, { recursive: true });
    await fs.writeFile(path.join(promptsDir, 'intro.md'), '# Intro');

    const config: FoldersConfig = {
      enabled: true,
      agents: {
        claude: { prompts: '.claude/prompts' },
        cursor: { tools: '.cursor/tools' },
      },
    };

    const { generatedPaths } = await propagateFolders(
      tmpDir,
      [new ClaudeAgent()],
      config,
      false,
      false,
    );

    const cursorTarget = path.join(tmpDir, '.cursor', 'tools');
    await expect(fs.access(cursorTarget)).rejects.toThrow();
    expect(generatedPaths).toEqual(['.claude/prompts']);
  });
});

describe('propagateFolders — cleanup', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-folder-clean-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('removes propagated targets when folders is disabled', async () => {
    const rulerDir = path.join(tmpDir, '.ruler');
    const promptsDir = path.join(rulerDir, 'prompts');
    await fs.mkdir(promptsDir, { recursive: true });
    await fs.writeFile(path.join(promptsDir, 'intro.md'), '# Intro');

    const enabledConfig: FoldersConfig = {
      enabled: true,
      agents: {
        claude: { prompts: '.claude/prompts' },
      },
    };

    await propagateFolders(
      tmpDir,
      [new ClaudeAgent()],
      enabledConfig,
      false,
      false,
    );

    const targetDir = path.join(tmpDir, '.claude', 'prompts');
    await expect(fs.access(targetDir)).resolves.toBeUndefined();

    const disabledConfig: FoldersConfig = {
      enabled: false,
      agents: {
        claude: { prompts: '.claude/prompts' },
      },
    };

    await propagateFolders(
      tmpDir,
      [new ClaudeAgent()],
      disabledConfig,
      false,
      false,
    );

    await expect(fs.access(targetDir)).rejects.toThrow();
  });

  it('does nothing during cleanup when target does not exist', async () => {
    const rulerDir = path.join(tmpDir, '.ruler');
    await fs.mkdir(rulerDir, { recursive: true });

    const disabledConfig: FoldersConfig = {
      enabled: false,
      agents: {
        claude: { prompts: '.claude/prompts' },
      },
    };

    const { generatedPaths } = await propagateFolders(
      tmpDir,
      [new ClaudeAgent()],
      disabledConfig,
      false,
      false,
    );

    expect(generatedPaths).toEqual([]);
  });

  it('does not error when folders has no agents config', async () => {
    const { generatedPaths } = await propagateFolders(
      tmpDir,
      [new ClaudeAgent()],
      { enabled: false },
      false,
      false,
    );
    expect(generatedPaths).toEqual([]);
  });
});
