import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import {
  propagateSubagents,
  propagateSubagentsForCursor,
  propagateSubagentsForCodex,
  propagateSubagentsForCopilot,
  _resetExperimentalWarningForTests,
} from '../../../src/core/SubagentsProcessor';
import {
  CLAUDE_SUBAGENTS_PATH,
  CURSOR_SUBAGENTS_PATH,
  CODEX_SUBAGENTS_PATH,
  COPILOT_SUBAGENTS_PATH,
  RULER_SUBAGENTS_PATH,
} from '../../../src/constants';
import { ClaudeAgent } from '../../../src/agents/ClaudeAgent';
import { CursorAgent } from '../../../src/agents/CursorAgent';
import { CodexCliAgent } from '../../../src/agents/CodexCliAgent';
import { CopilotAgent } from '../../../src/agents/CopilotAgent';
import { AiderAgent } from '../../../src/agents/AiderAgent';
import type { SubagentInfo } from '../../../src/types';

const VALID_SUB: SubagentInfo = {
  name: 'reviewer',
  path: '/dev/null/reviewer.md',
  valid: true,
  frontmatter: {
    name: 'reviewer',
    description: 'Reviews code',
    tools: ['Read', 'Grep'],
  },
  body: 'You review code.\n',
};

describe('SubagentsProcessor — per-target dry-run', () => {
  let tmpDir: string;
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-sub-proc-'));
  });
  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('propagateSubagentsForCursor in dry-run lists target paths and writes nothing', async () => {
    const result = await propagateSubagentsForCursor(tmpDir, [VALID_SUB], {
      dryRun: true,
    });
    expect(result).toEqual([
      `Write ${path.join(CURSOR_SUBAGENTS_PATH, 'reviewer.md')}`,
    ]);
    await expect(
      fs.access(path.join(tmpDir, CURSOR_SUBAGENTS_PATH)),
    ).rejects.toThrow();
  });

  it('propagateSubagentsForCodex in dry-run lists .toml target paths and writes nothing', async () => {
    const result = await propagateSubagentsForCodex(tmpDir, [VALID_SUB], {
      dryRun: true,
    });
    expect(result).toEqual([
      `Write ${path.join(CODEX_SUBAGENTS_PATH, 'reviewer.toml')}`,
    ]);
    await expect(
      fs.access(path.join(tmpDir, CODEX_SUBAGENTS_PATH)),
    ).rejects.toThrow();
  });

  it('propagateSubagentsForCopilot in dry-run lists target paths and surfaces tool-drop warnings', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const subWithUnknownTool: SubagentInfo = {
      ...VALID_SUB,
      frontmatter: {
        name: 'reviewer',
        description: 'x',
        tools: ['Read', 'CustomUnknown'],
      },
    };
    const result = await propagateSubagentsForCopilot(
      tmpDir,
      [subWithUnknownTool],
      {
        dryRun: true,
        verbose: false,
      },
    );
    expect(result.length).toBe(1);
    expect(result[0]).toContain(
      path.join(COPILOT_SUBAGENTS_PATH, 'reviewer.md'),
    );
    const warnings = warnSpy.mock.calls.map((args) => String(args[0]));
    expect(warnings.some((m) => m.includes('CustomUnknown'))).toBe(true);
    warnSpy.mockRestore();
  });

  it('returns empty array for all per-target propagators when there are no subagents', async () => {
    expect(
      await propagateSubagentsForCursor(tmpDir, [], { dryRun: true }),
    ).toEqual([]);
    expect(
      await propagateSubagentsForCodex(tmpDir, [], { dryRun: false }),
    ).toEqual([]);
    expect(
      await propagateSubagentsForCopilot(tmpDir, [], {
        dryRun: false,
        verbose: false,
      }),
    ).toEqual([]);
  });
});

describe('SubagentsProcessor — propagateSubagents orchestrator', () => {
  let tmpDir: string;
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-sub-orch-'));
    _resetExperimentalWarningForTests();
  });
  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('cleans up all four target dirs when subagentsEnabled is false', async () => {
    // Pre-create a stale target dir.
    const staleClaude = path.join(tmpDir, CLAUDE_SUBAGENTS_PATH);
    await fs.mkdir(staleClaude, { recursive: true });
    await fs.writeFile(path.join(staleClaude, 'old.md'), 'stale');

    await propagateSubagents(
      tmpDir,
      [new ClaudeAgent()],
      false, // subagentsEnabled
      false, // verbose
      false, // dryRun
    );

    await expect(fs.access(staleClaude)).rejects.toThrow();
  });

  it('cleans up all targets when .ruler/agents directory does not exist', async () => {
    const staleCursor = path.join(tmpDir, CURSOR_SUBAGENTS_PATH);
    await fs.mkdir(staleCursor, { recursive: true });
    await fs.writeFile(path.join(staleCursor, 'gone.md'), 'stale');

    // Source dir intentionally absent.
    await propagateSubagents(tmpDir, [new CursorAgent()], true, false, false);

    await expect(fs.access(staleCursor)).rejects.toThrow();
  });

  it('cleans up targets when .ruler/agents has no valid subagents', async () => {
    const sourceDir = path.join(tmpDir, RULER_SUBAGENTS_PATH);
    await fs.mkdir(sourceDir, { recursive: true });
    // File with no frontmatter — invalid, skipped with warning.
    await fs.writeFile(path.join(sourceDir, 'broken.md'), 'no frontmatter');

    const staleCodex = path.join(tmpDir, CODEX_SUBAGENTS_PATH);
    await fs.mkdir(staleCodex, { recursive: true });
    await fs.writeFile(path.join(staleCodex, 'leftover.toml'), 'stale');

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await propagateSubagents(tmpDir, [new CodexCliAgent()], true, false, false);

    await expect(fs.access(staleCodex)).rejects.toThrow();
    warnSpy.mockRestore();
  });

  it('warns and skips when none of the selected agents support native subagents', async () => {
    // Aider does not support native subagents.
    const sourceDir = path.join(tmpDir, RULER_SUBAGENTS_PATH);
    await fs.mkdir(sourceDir, { recursive: true });
    await fs.writeFile(
      path.join(sourceDir, 'reviewer.md'),
      '---\nname: reviewer\ndescription: x\n---\nbody\n',
    );

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await propagateSubagents(tmpDir, [new AiderAgent()], true, false, false);
    warnSpy.mockRestore();

    // No target directories should have been created.
    for (const target of [
      CLAUDE_SUBAGENTS_PATH,
      CURSOR_SUBAGENTS_PATH,
      CODEX_SUBAGENTS_PATH,
      COPILOT_SUBAGENTS_PATH,
    ]) {
      await expect(fs.access(path.join(tmpDir, target))).rejects.toThrow();
    }
  });

  it('reconciles target dirs by removing those for agents that left the selection', async () => {
    const sourceDir = path.join(tmpDir, RULER_SUBAGENTS_PATH);
    await fs.mkdir(sourceDir, { recursive: true });
    await fs.writeFile(
      path.join(sourceDir, 'reviewer.md'),
      '---\nname: reviewer\ndescription: Reviews code\ntools: [Read]\n---\nbody\n',
    );

    // Pre-existing cursor target dir from a previous run.
    const cursorDir = path.join(tmpDir, CURSOR_SUBAGENTS_PATH);
    await fs.mkdir(cursorDir, { recursive: true });
    await fs.writeFile(path.join(cursorDir, 'reviewer.md'), 'prev');

    // This run only selects claude — cursor dir must be reconciled away.
    await propagateSubagents(tmpDir, [new ClaudeAgent()], true, false, false);

    await expect(
      fs.access(path.join(tmpDir, CLAUDE_SUBAGENTS_PATH, 'reviewer.md')),
    ).resolves.toBeUndefined();
    await expect(fs.access(cursorDir)).rejects.toThrow();
  });
});

describe('SubagentsProcessor — Copilot model handling', () => {
  let tmpDir: string;
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-sub-copilot-'));
  });
  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('omits "model: inherit" from Copilot output and keeps explicit models', async () => {
    const inheritSub: SubagentInfo = {
      name: 'inh',
      path: '/dev/null/inh.md',
      valid: true,
      frontmatter: {
        name: 'inh',
        description: 'x',
        model: 'inherit',
      },
      body: 'body\n',
    };
    const explicitSub: SubagentInfo = {
      name: 'explicit',
      path: '/dev/null/explicit.md',
      valid: true,
      frontmatter: {
        name: 'explicit',
        description: 'x',
        model: 'opus',
      },
      body: 'body\n',
    };

    await propagateSubagentsForCopilot(tmpDir, [inheritSub, explicitSub], {
      dryRun: false,
      verbose: false,
    });

    const inhContent = await fs.readFile(
      path.join(tmpDir, COPILOT_SUBAGENTS_PATH, 'inh.md'),
      'utf8',
    );
    const explicitContent = await fs.readFile(
      path.join(tmpDir, COPILOT_SUBAGENTS_PATH, 'explicit.md'),
      'utf8',
    );

    expect(inhContent).not.toMatch(/^model:/m);
    expect(explicitContent).toMatch(/^model: opus/m);
  });
});
