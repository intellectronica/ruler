import * as path from 'path';
import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import { stringify as stringifyTOML } from '@iarna/toml';
import {
  RULER_SUBAGENTS_PATH,
  CLAUDE_SUBAGENTS_PATH,
  CURSOR_SUBAGENTS_PATH,
  CODEX_SUBAGENTS_PATH,
  COPILOT_SUBAGENTS_PATH,
  logWarn,
  logVerboseInfo,
} from '../constants';
import type { SubagentInfo, SubagentFrontmatter } from '../types';
import { loadSubagentFile, mapToolsForCopilot } from './SubagentsUtils';
import type { IAgent } from '../agents/IAgent';

/**
 * Discovers subagent definitions in `.ruler/agents/`.
 * Each `.md` file is parsed for YAML frontmatter (name, description, …).
 * Files that fail validation are dropped from the returned list and
 * reported via warnings.
 */
export async function discoverSubagents(
  projectRoot: string,
): Promise<{ subagents: SubagentInfo[]; warnings: string[] }> {
  const dir = path.join(projectRoot, RULER_SUBAGENTS_PATH);

  try {
    await fs.access(dir);
  } catch {
    return { subagents: [], warnings: [] };
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const mdFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => path.join(dir, entry.name))
    .sort();

  const subagents: SubagentInfo[] = [];
  const warnings: string[] = [];

  for (const filePath of mdFiles) {
    const info = await loadSubagentFile(filePath);
    if (info.valid) {
      subagents.push(info);
    } else if (info.error) {
      warnings.push(info.error);
    }
  }

  return { subagents, warnings };
}

type SubagentTarget = 'claude' | 'cursor' | 'codex' | 'copilot';

const SUBAGENT_TARGET_TO_IDENTIFIERS = new Map<
  SubagentTarget,
  readonly string[]
>([
  ['claude', ['claude']],
  ['cursor', ['cursor']],
  ['codex', ['codex']],
  ['copilot', ['copilot']],
]);

const SUBAGENT_TARGET_PATHS: Record<SubagentTarget, string> = {
  claude: CLAUDE_SUBAGENTS_PATH,
  cursor: CURSOR_SUBAGENTS_PATH,
  codex: CODEX_SUBAGENTS_PATH,
  copilot: COPILOT_SUBAGENTS_PATH,
};

/**
 * Returns which native subagent targets are reachable through the supplied
 * agent list. An agent only contributes to a target when it implements
 * `supportsNativeSubagents()` returning true.
 */
export function getSelectedSubagentTargets(
  agents: IAgent[],
): Set<SubagentTarget> {
  const enabledIdentifiers = new Set(
    agents
      .filter((agent) => agent.supportsNativeSubagents?.())
      .map((agent) => agent.getIdentifier()),
  );
  const targets = new Set<SubagentTarget>();
  for (const [target, identifiers] of SUBAGENT_TARGET_TO_IDENTIFIERS) {
    if (identifiers.some((id) => enabledIdentifiers.has(id))) {
      targets.add(target);
    }
  }
  return targets;
}

/**
 * Returns absolute paths that subagent propagation may generate, for the
 * supplied agents, used for `.gitignore` integration.
 */
export async function getSubagentsGitignorePaths(
  projectRoot: string,
  agents: IAgent[],
): Promise<string[]> {
  const dir = path.join(projectRoot, RULER_SUBAGENTS_PATH);
  try {
    await fs.access(dir);
  } catch {
    return [];
  }
  const targets = getSelectedSubagentTargets(agents);
  return Array.from(targets).map((t) =>
    path.join(projectRoot, SUBAGENT_TARGET_PATHS[t]),
  );
}

/**
 * Module-level state to track if experimental warning has been shown.
 * Mirrors the SkillsProcessor convention to avoid spamming the user across
 * multiple `apply` invocations within the same process.
 */
let hasWarnedExperimental = false;

function warnOnceExperimental(dryRun: boolean): void {
  if (hasWarnedExperimental) return;
  hasWarnedExperimental = true;
  logWarn(
    'Subagents support is experimental and behavior may change in future releases.',
    dryRun,
  );
}

/**
 * Test-only hook to reset the once-per-process experimental warning state.
 */
export function _resetExperimentalWarningForTests(): void {
  hasWarnedExperimental = false;
}

/* ------------------------------------------------------------------ */
/* Frontmatter helpers                                                 */
/* ------------------------------------------------------------------ */

function buildFrontmatterBlock(meta: Record<string, unknown>): string {
  const yamlText = yaml.dump(meta, { lineWidth: -1, noRefs: true }).trimEnd();
  return `---\n${yamlText}\n---\n`;
}

function ensureBodyFormatting(body: string | undefined): string {
  const text = (body ?? '').replace(/^\n+/, '');
  return text.endsWith('\n') ? text : `${text}\n`;
}

/* ------------------------------------------------------------------ */
/* Atomic directory write                                              */
/* ------------------------------------------------------------------ */

/**
 * Stages files into a temp directory and atomically swaps it into place.
 * Mirrors the pattern used by SkillsProcessor for safe overwriting.
 */
async function writeAgentsDirectoryAtomic(
  targetDir: string,
  files: { name: string; content: string }[],
): Promise<void> {
  const parent = path.dirname(targetDir);
  await fs.mkdir(parent, { recursive: true });

  const tempDir = path.join(parent, `agents.tmp-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });

  try {
    for (const { name, content } of files) {
      await fs.writeFile(path.join(tempDir, name), content, 'utf8');
    }
    try {
      await fs.rm(targetDir, { recursive: true, force: true });
    } catch {
      // Target didn't exist; ignore.
    }
    await fs.rename(tempDir, targetDir);
  } catch (error) {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors.
    }
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* Per-agent transformers                                              */
/* ------------------------------------------------------------------ */

interface PropagateOptions {
  dryRun: boolean;
}

function buildClaudeFile(sub: SubagentInfo): string {
  const fm = sub.frontmatter as SubagentFrontmatter;
  const meta: Record<string, unknown> = {
    name: fm.name,
    description: fm.description,
  };
  if (fm.tools !== undefined) meta.tools = fm.tools;
  if (fm.model !== undefined) meta.model = fm.model;
  return `${buildFrontmatterBlock(meta)}\n${ensureBodyFormatting(sub.body)}`;
}

function buildCursorFile(sub: SubagentInfo): string {
  const fm = sub.frontmatter as SubagentFrontmatter;
  const meta: Record<string, unknown> = {
    name: fm.name,
    description: fm.description,
    model: fm.model ?? 'inherit',
    readonly: fm.readonly ?? false,
    is_background: fm.is_background ?? false,
  };
  return `${buildFrontmatterBlock(meta)}\n${ensureBodyFormatting(sub.body)}`;
}

function buildCodexFile(sub: SubagentInfo): string {
  const fm = sub.frontmatter as SubagentFrontmatter;
  const config: Record<string, unknown> = {
    name: fm.name,
    description: fm.description,
    developer_instructions: ensureBodyFormatting(sub.body),
  };
  if (fm.model !== undefined && fm.model !== 'inherit') {
    config.model = fm.model;
  }
  if (fm.readonly === true) {
    config.sandbox_mode = 'read-only';
  }
  // @iarna/toml requires JsonMap; the cast is safe because every value is a
  // string/boolean/number/object that the library knows how to serialize.
  return stringifyTOML(config as Parameters<typeof stringifyTOML>[0]);
}

function buildCopilotFile(
  sub: SubagentInfo,
  dryRun: boolean,
): { content: string; warnings: string[] } {
  const fm = sub.frontmatter as SubagentFrontmatter;
  const meta: Record<string, unknown> = {
    name: fm.name,
    description: fm.description,
    'user-invocable': true,
  };
  const warnings: string[] = [];
  if (fm.tools && fm.tools.length > 0) {
    const { tools, unknown } = mapToolsForCopilot(fm.tools);
    if (tools.length > 0) {
      meta.tools = tools;
    }
    if (unknown.length > 0) {
      warnings.push(
        `Subagent "${fm.name}": dropping tools not mappable to Copilot aliases: ${unknown.join(', ')}`,
      );
    }
  }
  if (fm.model !== undefined && fm.model !== 'inherit') {
    meta.model = fm.model;
  }
  if (fm.readonly === true) {
    meta['disable-model-invocation'] = true;
  }
  // Surface warnings via logWarn so they're visible to the user.
  for (const warning of warnings) {
    logWarn(warning, dryRun);
  }
  return {
    content: `${buildFrontmatterBlock(meta)}\n${ensureBodyFormatting(sub.body)}`,
    warnings,
  };
}

export async function propagateSubagentsForClaude(
  projectRoot: string,
  subagents: SubagentInfo[],
  options: PropagateOptions,
): Promise<string[]> {
  if (subagents.length === 0) return [];
  const targetDir = path.join(projectRoot, CLAUDE_SUBAGENTS_PATH);
  if (options.dryRun) {
    return subagents.map(
      (s) => `Write ${path.join(CLAUDE_SUBAGENTS_PATH, `${s.name}.md`)}`,
    );
  }
  const files = subagents.map((s) => ({
    name: `${s.name}.md`,
    content: buildClaudeFile(s),
  }));
  await writeAgentsDirectoryAtomic(targetDir, files);
  return [];
}

export async function propagateSubagentsForCursor(
  projectRoot: string,
  subagents: SubagentInfo[],
  options: PropagateOptions,
): Promise<string[]> {
  if (subagents.length === 0) return [];
  const targetDir = path.join(projectRoot, CURSOR_SUBAGENTS_PATH);
  if (options.dryRun) {
    return subagents.map(
      (s) => `Write ${path.join(CURSOR_SUBAGENTS_PATH, `${s.name}.md`)}`,
    );
  }
  const files = subagents.map((s) => ({
    name: `${s.name}.md`,
    content: buildCursorFile(s),
  }));
  await writeAgentsDirectoryAtomic(targetDir, files);
  return [];
}

export async function propagateSubagentsForCodex(
  projectRoot: string,
  subagents: SubagentInfo[],
  options: PropagateOptions,
): Promise<string[]> {
  if (subagents.length === 0) return [];
  const targetDir = path.join(projectRoot, CODEX_SUBAGENTS_PATH);
  if (options.dryRun) {
    return subagents.map(
      (s) => `Write ${path.join(CODEX_SUBAGENTS_PATH, `${s.name}.toml`)}`,
    );
  }
  const files = subagents.map((s) => ({
    name: `${s.name}.toml`,
    content: buildCodexFile(s),
  }));
  await writeAgentsDirectoryAtomic(targetDir, files);
  return [];
}

export async function propagateSubagentsForCopilot(
  projectRoot: string,
  subagents: SubagentInfo[],
  options: PropagateOptions,
): Promise<string[]> {
  if (subagents.length === 0) return [];
  const targetDir = path.join(projectRoot, COPILOT_SUBAGENTS_PATH);
  if (options.dryRun) {
    const planLines: string[] = [];
    for (const s of subagents) {
      // Surface tool-mapping warnings during dry-run too.
      buildCopilotFile(s, true);
      planLines.push(
        `Write ${path.join(COPILOT_SUBAGENTS_PATH, `${s.name}.md`)}`,
      );
    }
    return planLines;
  }
  const files = subagents.map((s) => ({
    name: `${s.name}.md`,
    content: buildCopilotFile(s, false).content,
  }));
  await writeAgentsDirectoryAtomic(targetDir, files);
  return [];
}

/* ------------------------------------------------------------------ */
/* Cleanup-on-disable                                                  */
/* ------------------------------------------------------------------ */

async function cleanupSubagentsDir(
  projectRoot: string,
  relPath: string,
  dryRun: boolean,
  verbose: boolean,
): Promise<void> {
  const target = path.join(projectRoot, relPath);
  try {
    await fs.access(target);
  } catch {
    return;
  }
  if (dryRun) {
    logVerboseInfo(`DRY RUN: Would remove ${relPath}`, verbose, dryRun);
    return;
  }
  await fs.rm(target, { recursive: true, force: true });
  logVerboseInfo(`Removed ${relPath} (subagents disabled)`, verbose, dryRun);
}

async function cleanupAllSubagentsDirectories(
  projectRoot: string,
  dryRun: boolean,
  verbose: boolean,
): Promise<void> {
  await cleanupSubagentsDir(
    projectRoot,
    CLAUDE_SUBAGENTS_PATH,
    dryRun,
    verbose,
  );
  await cleanupSubagentsDir(
    projectRoot,
    CURSOR_SUBAGENTS_PATH,
    dryRun,
    verbose,
  );
  await cleanupSubagentsDir(projectRoot, CODEX_SUBAGENTS_PATH, dryRun, verbose);
  await cleanupSubagentsDir(
    projectRoot,
    COPILOT_SUBAGENTS_PATH,
    dryRun,
    verbose,
  );
}

/* ------------------------------------------------------------------ */
/* Orchestrator                                                        */
/* ------------------------------------------------------------------ */

export async function propagateSubagents(
  projectRoot: string,
  agents: IAgent[],
  subagentsEnabled: boolean,
  verbose: boolean,
  dryRun: boolean,
): Promise<void> {
  if (!subagentsEnabled) {
    logVerboseInfo(
      'Subagents support disabled, cleaning up subagent directories',
      verbose,
      dryRun,
    );
    await cleanupAllSubagentsDirectories(projectRoot, dryRun, verbose);
    return;
  }

  const sourceDir = path.join(projectRoot, RULER_SUBAGENTS_PATH);
  try {
    await fs.access(sourceDir);
  } catch {
    logVerboseInfo(
      'No .ruler/agents directory found, skipping subagent propagation',
      verbose,
      dryRun,
    );
    return;
  }

  const { subagents, warnings } = await discoverSubagents(projectRoot);
  for (const w of warnings) logWarn(w, dryRun);

  if (subagents.length === 0) {
    logVerboseInfo(
      'No valid subagents found in .ruler/agents',
      verbose,
      dryRun,
    );
    return;
  }

  logVerboseInfo(`Discovered ${subagents.length} subagent(s)`, verbose, dryRun);

  const supporting = agents.filter((a) => a.supportsNativeSubagents?.());
  const nonSupporting = agents.filter((a) => !a.supportsNativeSubagents?.());

  if (nonSupporting.length > 0) {
    const names = nonSupporting.map((a) => a.getName()).join(', ');
    logWarn(
      `Subagents are configured, but the following agents do not support native subagents and will be skipped: ${names}`,
      dryRun,
    );
  }

  if (supporting.length === 0) {
    logVerboseInfo(
      'No agents support native subagents, skipping subagent propagation',
      verbose,
      dryRun,
    );
    return;
  }

  warnOnceExperimental(dryRun);

  const targets = getSelectedSubagentTargets(agents);

  if (targets.has('claude')) {
    logVerboseInfo(
      `Writing subagents to ${CLAUDE_SUBAGENTS_PATH} for Claude Code`,
      verbose,
      dryRun,
    );
    await propagateSubagentsForClaude(projectRoot, subagents, { dryRun });
  }
  if (targets.has('cursor')) {
    logVerboseInfo(
      `Writing subagents to ${CURSOR_SUBAGENTS_PATH} for Cursor`,
      verbose,
      dryRun,
    );
    await propagateSubagentsForCursor(projectRoot, subagents, { dryRun });
  }
  if (targets.has('codex')) {
    logVerboseInfo(
      `Writing subagents to ${CODEX_SUBAGENTS_PATH} for OpenAI Codex CLI`,
      verbose,
      dryRun,
    );
    await propagateSubagentsForCodex(projectRoot, subagents, { dryRun });
  }
  if (targets.has('copilot')) {
    logVerboseInfo(
      `Writing subagents to ${COPILOT_SUBAGENTS_PATH} for GitHub Copilot`,
      verbose,
      dryRun,
    );
    await propagateSubagentsForCopilot(projectRoot, subagents, { dryRun });
  }
}
