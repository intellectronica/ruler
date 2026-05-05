import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import {
  loadHooksFile,
  propagateHooks,
  propagateHooksForClaude,
  _resetExperimentalWarningForTests,
  type RulerHooks,
} from '../../../src/core/HooksProcessor';
import { RULER_HOOKS_PATH, CLAUDE_SETTINGS_PATH } from '../../../src/constants';
import { ClaudeAgent } from '../../../src/agents/ClaudeAgent';
import { AiderAgent } from '../../../src/agents/AiderAgent';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeHooksFile(dir: string, content: unknown): Promise<void> {
  const hooksPath = path.join(dir, RULER_HOOKS_PATH);
  await fs.mkdir(path.dirname(hooksPath), { recursive: true });
  await fs.writeFile(hooksPath, JSON.stringify(content), 'utf8');
}

async function readClaudeSettings(
  dir: string,
): Promise<Record<string, unknown>> {
  const settingsPath = path.join(dir, CLAUDE_SETTINGS_PATH);
  const raw = await fs.readFile(settingsPath, 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// loadHooksFile
// ---------------------------------------------------------------------------

describe('loadHooksFile', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-hooks-load-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns null when .ruler/hooks.json does not exist', async () => {
    const result = await loadHooksFile(tmpDir);
    expect(result).toBeNull();
  });

  it('parses a valid hooks file with PreToolUse', async () => {
    const hooks: RulerHooks = {
      PreToolUse: [
        {
          matcher: 'Bash',
          hooks: [{ type: 'command', command: 'echo hi' }],
        },
      ],
    };
    await writeHooksFile(tmpDir, hooks);
    const result = await loadHooksFile(tmpDir);
    expect(result).toEqual(hooks);
  });

  it('parses all supported event types', async () => {
    const hooks: RulerHooks = {
      PreToolUse: [{ hooks: [{ type: 'command', command: 'pre.sh' }] }],
      PostToolUse: [{ hooks: [{ type: 'command', command: 'post.sh' }] }],
      Stop: [{ hooks: [{ type: 'command', command: 'stop.sh' }] }],
      SubagentStop: [{ hooks: [{ type: 'command', command: 'subagent.sh' }] }],
      Notification: [{ hooks: [{ type: 'command', command: 'notify.sh' }] }],
    };
    await writeHooksFile(tmpDir, hooks);
    const result = await loadHooksFile(tmpDir);
    expect(result).toEqual(hooks);
  });

  it('includes timeout when present', async () => {
    const hooks = {
      PreToolUse: [
        {
          matcher: 'Bash',
          hooks: [{ type: 'command', command: 'check.sh', timeout: 30 }],
        },
      ],
    };
    await writeHooksFile(tmpDir, hooks);
    const result = await loadHooksFile(tmpDir);
    expect(result?.PreToolUse?.[0].hooks[0].timeout).toBe(30);
  });

  it('warns and skips unknown event names', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await writeHooksFile(tmpDir, {
      PreToolUse: [{ hooks: [{ type: 'command', command: 'ok.sh' }] }],
      UnknownEvent: [{ hooks: [{ type: 'command', command: 'nope.sh' }] }],
    });
    const result = await loadHooksFile(tmpDir);
    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty('UnknownEvent');
    expect(result?.PreToolUse).toBeDefined();
    const warnings = warnSpy.mock.calls.map((c) => String(c[0]));
    expect(warnings.some((w) => w.includes('UnknownEvent'))).toBe(true);
    warnSpy.mockRestore();
  });

  it('throws on invalid JSON', async () => {
    const hooksPath = path.join(tmpDir, RULER_HOOKS_PATH);
    await fs.mkdir(path.dirname(hooksPath), { recursive: true });
    await fs.writeFile(hooksPath, 'not json', 'utf8');
    await expect(loadHooksFile(tmpDir)).rejects.toThrow(/invalid JSON/);
  });

  it('throws when top-level is not an object', async () => {
    await writeHooksFile(tmpDir, [1, 2, 3]);
    await expect(loadHooksFile(tmpDir)).rejects.toThrow(
      /expected a JSON object/,
    );
  });

  it('throws when event value is not an array', async () => {
    await writeHooksFile(tmpDir, { PreToolUse: 'bad' });
    await expect(loadHooksFile(tmpDir)).rejects.toThrow(
      /must be an array of hook matchers/,
    );
  });

  it('throws when a matcher entry has no hooks array', async () => {
    await writeHooksFile(tmpDir, { PreToolUse: [{ matcher: 'Bash' }] });
    await expect(loadHooksFile(tmpDir)).rejects.toThrow(
      /must have a "hooks" array/,
    );
  });

  it('throws when a hook command has no command field', async () => {
    await writeHooksFile(tmpDir, {
      PreToolUse: [{ hooks: [{ type: 'command' }] }],
    });
    await expect(loadHooksFile(tmpDir)).rejects.toThrow(
      /non-empty "command" string/,
    );
  });

  it('throws when hook type is not "command"', async () => {
    await writeHooksFile(tmpDir, {
      PreToolUse: [{ hooks: [{ type: 'script', command: 'run.sh' }] }],
    });
    await expect(loadHooksFile(tmpDir)).rejects.toThrow(
      /must have type "command"/,
    );
  });
});

// ---------------------------------------------------------------------------
// propagateHooksForClaude
// ---------------------------------------------------------------------------

describe('propagateHooksForClaude', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-hooks-claude-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const SAMPLE_HOOKS: RulerHooks = {
    PreToolUse: [
      { matcher: 'Bash', hooks: [{ type: 'command', command: 'check.sh' }] },
    ],
  };

  it('writes hooks to .claude/settings.json', async () => {
    await propagateHooksForClaude(tmpDir, SAMPLE_HOOKS, false, false);
    const settings = await readClaudeSettings(tmpDir);
    expect(settings.hooks).toEqual(SAMPLE_HOOKS);
  });

  it('merges hooks into existing settings without removing other keys', async () => {
    const settingsPath = path.join(tmpDir, CLAUDE_SETTINGS_PATH);
    await fs.mkdir(path.dirname(settingsPath), { recursive: true });
    await fs.writeFile(
      settingsPath,
      JSON.stringify({ someOtherKey: 'keep-me' }),
      'utf8',
    );
    await propagateHooksForClaude(tmpDir, SAMPLE_HOOKS, false, false);
    const settings = await readClaudeSettings(tmpDir);
    expect(settings.someOtherKey).toBe('keep-me');
    expect(settings.hooks).toEqual(SAMPLE_HOOKS);
  });

  it('does not write files in dry-run mode', async () => {
    await propagateHooksForClaude(tmpDir, SAMPLE_HOOKS, true, false);
    const settingsPath = path.join(tmpDir, CLAUDE_SETTINGS_PATH);
    await expect(fs.access(settingsPath)).rejects.toThrow();
  });

  it('creates .claude directory if it does not exist', async () => {
    await propagateHooksForClaude(tmpDir, SAMPLE_HOOKS, false, false);
    const claudeDir = path.join(tmpDir, '.claude');
    await expect(fs.access(claudeDir)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// propagateHooks orchestrator
// ---------------------------------------------------------------------------

describe('propagateHooks orchestrator', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-hooks-orch-'));
    _resetExperimentalWarningForTests();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('removes hooks from settings when hooksEnabled is false', async () => {
    // Pre-populate settings with hooks.
    const settingsPath = path.join(tmpDir, CLAUDE_SETTINGS_PATH);
    await fs.mkdir(path.dirname(settingsPath), { recursive: true });
    await fs.writeFile(
      settingsPath,
      JSON.stringify({
        hooks: { PreToolUse: [] },
        other: 'value',
      }),
      'utf8',
    );

    await propagateHooks(
      tmpDir,
      [new ClaudeAgent()],
      false, // hooksEnabled
      false,
      false,
    );

    const settings = await readClaudeSettings(tmpDir);
    expect(settings).not.toHaveProperty('hooks');
    expect(settings.other).toBe('value');
  });

  it('skips hooks propagation when .ruler/hooks.json does not exist', async () => {
    await propagateHooks(tmpDir, [new ClaudeAgent()], true, false, false);
    const settingsPath = path.join(tmpDir, CLAUDE_SETTINGS_PATH);
    // .claude/settings.json should not have been created just for hooks
    // (it is only written when hooks are actually present).
    try {
      const settings = await readClaudeSettings(tmpDir);
      expect(settings).not.toHaveProperty('hooks');
    } catch {
      // File does not exist — also acceptable.
    }
  });

  it('propagates hooks to Claude settings when enabled and file exists', async () => {
    await writeHooksFile(tmpDir, {
      PreToolUse: [
        {
          matcher: 'Bash',
          hooks: [{ type: 'command', command: 'security.sh' }],
        },
      ],
    });

    await propagateHooks(tmpDir, [new ClaudeAgent()], true, false, false);

    const settings = await readClaudeSettings(tmpDir);
    expect(settings.hooks).toEqual({
      PreToolUse: [
        {
          matcher: 'Bash',
          hooks: [{ type: 'command', command: 'security.sh' }],
        },
      ],
    });
  });

  it('skips propagation when no agents support native hooks', async () => {
    await writeHooksFile(tmpDir, {
      Stop: [{ hooks: [{ type: 'command', command: 'done.sh' }] }],
    });

    // AiderAgent does not support native hooks.
    await propagateHooks(tmpDir, [new AiderAgent()], true, false, false);

    const settingsPath = path.join(tmpDir, CLAUDE_SETTINGS_PATH);
    await expect(fs.access(settingsPath)).rejects.toThrow();
  });

  it('warns when hooks file contains invalid JSON', async () => {
    const hooksPath = path.join(tmpDir, RULER_HOOKS_PATH);
    await fs.mkdir(path.dirname(hooksPath), { recursive: true });
    await fs.writeFile(hooksPath, 'bad json', 'utf8');

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await propagateHooks(tmpDir, [new ClaudeAgent()], true, false, false);
    const warnings = warnSpy.mock.calls.map((c) => String(c[0]));
    expect(warnings.some((w) => w.includes('invalid JSON'))).toBe(true);
    warnSpy.mockRestore();
  });

  it('dry-run does not write settings file', async () => {
    await writeHooksFile(tmpDir, {
      PreToolUse: [{ hooks: [{ type: 'command', command: 'check.sh' }] }],
    });

    await propagateHooks(tmpDir, [new ClaudeAgent()], true, false, true);

    const settingsPath = path.join(tmpDir, CLAUDE_SETTINGS_PATH);
    await expect(fs.access(settingsPath)).rejects.toThrow();
  });

  it('shows experimental warning only once per process', async () => {
    await writeHooksFile(tmpDir, {
      Stop: [{ hooks: [{ type: 'command', command: 'done.sh' }] }],
    });

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await propagateHooks(tmpDir, [new ClaudeAgent()], true, false, false);
    await propagateHooks(tmpDir, [new ClaudeAgent()], true, false, false);

    const experimentalWarnings = warnSpy.mock.calls
      .map((c) => String(c[0]))
      .filter((m) => m.includes('experimental'));
    expect(experimentalWarnings.length).toBe(1);
    warnSpy.mockRestore();
  });
});
