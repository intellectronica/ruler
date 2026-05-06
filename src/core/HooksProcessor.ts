import * as path from 'path';
import * as fs from 'fs/promises';
import {
  RULER_HOOKS_PATH,
  CLAUDE_SETTINGS_PATH,
  CURSOR_SETTINGS_PATH,
  COPILOT_SETTINGS_PATH,
  logWarn,
  logVerboseInfo,
} from '../constants';
import type { IAgent } from '../agents/IAgent';

/**
 * A single hook command entry as used by Claude Code.
 */
export interface HookCommand {
  type: 'command';
  command: string;
  timeout?: number;
}

/**
 * A hook matcher block that attaches one or more commands to a tool pattern.
 */
export interface HookMatcher {
  matcher?: string;
  hooks: HookCommand[];
}

/**
 * The set of lifecycle events recognised by Claude Code's hooks system.
 */
export type ClaudeHookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'Stop'
  | 'SubagentStop'
  | 'Notification';

/**
 * The top-level hooks definition stored in `.ruler/hooks.json`.
 * Keys are Claude Code lifecycle event names; values are arrays of matchers.
 */
export type RulerHooks = Partial<Record<ClaudeHookEvent, HookMatcher[]>>;

const SUPPORTED_EVENTS: ClaudeHookEvent[] = [
  'PreToolUse',
  'PostToolUse',
  'Stop',
  'SubagentStop',
  'Notification',
];

/**
 * Reads and parses `.ruler/hooks.json` from the project root.
 * Returns null if the file does not exist.
 * Throws a descriptive error if the file is present but contains invalid JSON
 * or an unexpected structure.
 */
export async function loadHooksFile(
  projectRoot: string,
): Promise<RulerHooks | null> {
  const hooksPath = path.join(projectRoot, RULER_HOOKS_PATH);
  let raw: string;
  try {
    raw = await fs.readFile(hooksPath, 'utf8');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw new Error(
      `Failed to read ${RULER_HOOKS_PATH}: ${(err as Error).message}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err: unknown) {
    throw new Error(
      `${RULER_HOOKS_PATH}: invalid JSON: ${(err as Error).message}`,
    );
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      `${RULER_HOOKS_PATH}: expected a JSON object at the top level`,
    );
  }

  const obj = parsed as Record<string, unknown>;
  const hooks: RulerHooks = {};

  for (const [key, value] of Object.entries(obj)) {
    if (!(SUPPORTED_EVENTS as string[]).includes(key)) {
      logWarn(
        `${RULER_HOOKS_PATH}: unknown hook event "${key}" — supported events are: ${SUPPORTED_EVENTS.join(', ')}`,
      );
      continue;
    }
    const event = key as ClaudeHookEvent;
    if (!Array.isArray(value)) {
      throw new Error(
        `${RULER_HOOKS_PATH}: value for event "${event}" must be an array of hook matchers`,
      );
    }
    const matchers: HookMatcher[] = [];
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        throw new Error(
          `${RULER_HOOKS_PATH}: item [${i}] under "${event}" must be an object`,
        );
      }
      const itemObj = item as Record<string, unknown>;
      if (!Array.isArray(itemObj.hooks)) {
        throw new Error(
          `${RULER_HOOKS_PATH}: item [${i}] under "${event}" must have a "hooks" array`,
        );
      }
      const commands: HookCommand[] = [];
      for (let j = 0; j < itemObj.hooks.length; j++) {
        const cmdObj = (itemObj.hooks as unknown[])[j];
        if (
          typeof cmdObj !== 'object' ||
          cmdObj === null ||
          Array.isArray(cmdObj)
        ) {
          throw new Error(
            `${RULER_HOOKS_PATH}: hooks[${j}] under "${event}"[${i}] must be an object`,
          );
        }
        const cmd = cmdObj as Record<string, unknown>;
        if (cmd.type !== 'command') {
          throw new Error(
            `${RULER_HOOKS_PATH}: hooks[${j}] under "${event}"[${i}] must have type "command"`,
          );
        }
        if (typeof cmd.command !== 'string' || cmd.command.length === 0) {
          throw new Error(
            `${RULER_HOOKS_PATH}: hooks[${j}] under "${event}"[${i}] must have a non-empty "command" string`,
          );
        }
        const hookCmd: HookCommand = { type: 'command', command: cmd.command };
        if (typeof cmd.timeout === 'number') {
          hookCmd.timeout = cmd.timeout;
        }
        commands.push(hookCmd);
      }
      const matcher: HookMatcher = { hooks: commands };
      if (typeof itemObj.matcher === 'string') {
        matcher.matcher = itemObj.matcher;
      }
      matchers.push(matcher);
    }
    hooks[event] = matchers;
  }

  return hooks;
}

/**
 * Reads a JSON settings file from the project root.
 * Returns an empty object if the file does not exist or is not a valid object.
 */
async function readSettingsFile(
  settingsPath: string,
): Promise<Record<string, unknown>> {
  try {
    const raw = await fs.readFile(settingsPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Writes a JSON settings object to a file, creating parent directories as needed.
 */
async function writeSettingsFile(
  settingsPath: string,
  settings: Record<string, unknown>,
): Promise<void> {
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n', {
    encoding: 'utf8',
  });
}

/**
 * Reads the existing `.claude/settings.json` from the project root.
 * Returns an empty object if the file does not exist.
 */
async function readClaudeSettings(
  projectRoot: string,
): Promise<Record<string, unknown>> {
  return readSettingsFile(path.join(projectRoot, CLAUDE_SETTINGS_PATH));
}

/**
 * Writes the updated settings object to `.claude/settings.json`,
 * creating the `.claude` directory if needed.
 */
async function writeClaudeSettings(
  projectRoot: string,
  settings: Record<string, unknown>,
): Promise<void> {
  await writeSettingsFile(
    path.join(projectRoot, CLAUDE_SETTINGS_PATH),
    settings,
  );
}

/**
 * Propagates hooks into `.claude/settings.json` for Claude Code.
 * Merges ruler-managed hooks into the existing settings, replacing any
 * previously ruler-managed hooks entries while preserving other settings.
 */
export async function propagateHooksForClaude(
  projectRoot: string,
  hooks: RulerHooks,
  dryRun: boolean,
  verbose: boolean,
): Promise<void> {
  if (dryRun) {
    logVerboseInfo(
      `DRY RUN: Would write hooks to ${CLAUDE_SETTINGS_PATH}`,
      verbose,
      dryRun,
    );
    return;
  }

  const settings = await readClaudeSettings(projectRoot);
  settings.hooks = hooks;
  await writeClaudeSettings(projectRoot, settings);
}

/**
 * Propagates hooks into `.cursor/settings.json` for Cursor.
 * Merges ruler-managed hooks into the existing settings, replacing any
 * previously ruler-managed hooks entries while preserving other settings.
 */
export async function propagateHooksForCursor(
  projectRoot: string,
  hooks: RulerHooks,
  dryRun: boolean,
  verbose: boolean,
): Promise<void> {
  if (dryRun) {
    logVerboseInfo(
      `DRY RUN: Would write hooks to ${CURSOR_SETTINGS_PATH}`,
      verbose,
      dryRun,
    );
    return;
  }

  const settingsPath = path.join(projectRoot, CURSOR_SETTINGS_PATH);
  const settings = await readSettingsFile(settingsPath);
  settings.hooks = hooks;
  await writeSettingsFile(settingsPath, settings);
}

/**
 * Propagates hooks into `.github/copilot-settings.json` for GitHub Copilot.
 * Merges ruler-managed hooks into the existing settings, replacing any
 * previously ruler-managed hooks entries while preserving other settings.
 */
export async function propagateHooksForCopilot(
  projectRoot: string,
  hooks: RulerHooks,
  dryRun: boolean,
  verbose: boolean,
): Promise<void> {
  if (dryRun) {
    logVerboseInfo(
      `DRY RUN: Would write hooks to ${COPILOT_SETTINGS_PATH}`,
      verbose,
      dryRun,
    );
    return;
  }

  const settingsPath = path.join(projectRoot, COPILOT_SETTINGS_PATH);
  const settings = await readSettingsFile(settingsPath);
  settings.hooks = hooks;
  await writeSettingsFile(settingsPath, settings);
}

/**
 * Removes the ruler-managed `hooks` key from a JSON settings file.
 * If the file does not exist, or no `hooks` key is present, this is a no-op.
 */
async function cleanupHooksFromSettingsFile(
  settingsPath: string,
  relPath: string,
  dryRun: boolean,
  verbose: boolean,
): Promise<void> {
  try {
    await fs.access(settingsPath);
  } catch {
    return; // File doesn't exist, nothing to clean up.
  }
  if (dryRun) {
    logVerboseInfo(
      `DRY RUN: Would remove hooks from ${relPath}`,
      verbose,
      dryRun,
    );
    return;
  }
  const settings = await readSettingsFile(settingsPath);
  if ('hooks' in settings) {
    delete settings.hooks;
    await writeSettingsFile(settingsPath, settings);
    logVerboseInfo(
      `Removed hooks from ${relPath} (hooks disabled)`,
      verbose,
      dryRun,
    );
  }
}

/**
 * Removes ruler-managed hooks from all supported agent settings files.
 */
async function cleanupAllHooks(
  projectRoot: string,
  dryRun: boolean,
  verbose: boolean,
): Promise<void> {
  await cleanupHooksFromSettingsFile(
    path.join(projectRoot, CLAUDE_SETTINGS_PATH),
    CLAUDE_SETTINGS_PATH,
    dryRun,
    verbose,
  );
  await cleanupHooksFromSettingsFile(
    path.join(projectRoot, CURSOR_SETTINGS_PATH),
    CURSOR_SETTINGS_PATH,
    dryRun,
    verbose,
  );
  await cleanupHooksFromSettingsFile(
    path.join(projectRoot, COPILOT_SETTINGS_PATH),
    COPILOT_SETTINGS_PATH,
    dryRun,
    verbose,
  );
}

/**
 * Module-level state to track if experimental warning has been shown.
 */
let hasWarnedExperimental = false;

function warnOnceExperimental(dryRun: boolean): void {
  if (hasWarnedExperimental) return;
  hasWarnedExperimental = true;
  logWarn(
    'Hooks support is experimental and behavior may change in future releases.',
    dryRun,
  );
}

/**
 * Test-only hook to reset the once-per-process experimental warning state.
 */
export function _resetExperimentalWarningForTests(): void {
  hasWarnedExperimental = false;
}

/**
 * Orchestrates hooks propagation for all supported agents.
 * Reads `.ruler/hooks.json` and writes hooks to each agent's native location.
 */
export async function propagateHooks(
  projectRoot: string,
  agents: IAgent[],
  hooksEnabled: boolean,
  verbose: boolean,
  dryRun: boolean,
): Promise<void> {
  if (!hooksEnabled) {
    logVerboseInfo(
      'Hooks support disabled, cleaning up hooks from agent settings',
      verbose,
      dryRun,
    );
    await cleanupAllHooks(projectRoot, dryRun, verbose);
    return;
  }

  let hooks: RulerHooks | null;
  try {
    hooks = await loadHooksFile(projectRoot);
  } catch (err: unknown) {
    logWarn((err as Error).message, dryRun);
    return;
  }

  if (hooks === null) {
    logVerboseInfo(
      `No ${RULER_HOOKS_PATH} found, skipping hooks propagation`,
      verbose,
      dryRun,
    );
    return;
  }

  const eventCount = Object.keys(hooks).length;
  if (eventCount === 0) {
    logVerboseInfo(
      `${RULER_HOOKS_PATH} contains no hook events, skipping hooks propagation`,
      verbose,
      dryRun,
    );
    return;
  }

  logVerboseInfo(
    `Discovered hooks for ${eventCount} event(s)`,
    verbose,
    dryRun,
  );

  const hookSupportingAgents = agents.filter((a) => a.supportsNativeHooks?.());

  if (hookSupportingAgents.length === 0) {
    logVerboseInfo(
      'No agents support native hooks, skipping hooks propagation',
      verbose,
      dryRun,
    );
    return;
  }

  warnOnceExperimental(dryRun);

  const claudeAgent = hookSupportingAgents.find(
    (a) => a.getIdentifier() === 'claude',
  );
  if (claudeAgent) {
    logVerboseInfo(
      `Writing hooks to ${CLAUDE_SETTINGS_PATH} for Claude Code`,
      verbose,
      dryRun,
    );
    await propagateHooksForClaude(projectRoot, hooks, dryRun, verbose);
  }

  const cursorAgent = hookSupportingAgents.find(
    (a) => a.getIdentifier() === 'cursor',
  );
  if (cursorAgent) {
    logVerboseInfo(
      `Writing hooks to ${CURSOR_SETTINGS_PATH} for Cursor`,
      verbose,
      dryRun,
    );
    await propagateHooksForCursor(projectRoot, hooks, dryRun, verbose);
  }

  const copilotAgent = hookSupportingAgents.find(
    (a) => a.getIdentifier() === 'copilot',
  );
  if (copilotAgent) {
    logVerboseInfo(
      `Writing hooks to ${COPILOT_SETTINGS_PATH} for GitHub Copilot`,
      verbose,
      dryRun,
    );
    await propagateHooksForCopilot(projectRoot, hooks, dryRun, verbose);
  }
}
