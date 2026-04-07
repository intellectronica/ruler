import * as path from 'path';
import * as fs from 'fs/promises';
import { SkillInfo } from '../types';
import {
  RULER_SKILLS_PATH,
  SKILLS_DIR,
  CLAUDE_SKILLS_PATH,
  CODEX_SKILLS_PATH,
  OPENCODE_SKILLS_PATH,
  PI_SKILLS_PATH,
  GOOSE_SKILLS_PATH,
  VIBE_SKILLS_PATH,
  ROO_SKILLS_PATH,
  GEMINI_SKILLS_PATH,
  JUNIE_SKILLS_PATH,
  CURSOR_SKILLS_PATH,
  WINDSURF_SKILLS_PATH,
  FACTORY_SKILLS_PATH,
  ANTIGRAVITY_SKILLS_PATH,
  logWarn,
  logVerboseInfo,
} from '../constants';
import { walkSkillsTree, copySkillsDirectory, mergeSkillsDirectories } from './SkillsUtils';
import { findGlobalRulerDir } from './FileSystemUtils';
import type { IAgent } from '../agents/IAgent';

/**
 * Discovers skills in the project's .ruler/skills directory.
 * Returns discovered skills and any validation warnings.
 */
export async function discoverSkills(
  projectRoot: string,
): Promise<{ skills: SkillInfo[]; warnings: string[] }> {
  const skillsDir = path.join(projectRoot, RULER_SKILLS_PATH);

  // Check if skills directory exists
  try {
    await fs.access(skillsDir);
  } catch {
    // Skills directory doesn't exist - this is fine, just return empty
    return { skills: [], warnings: [] };
  }

  // Walk the skills tree
  return await walkSkillsTree(skillsDir);
}

/**
 * Discovers skills in the global config directory (~/.config/ruler/skills).
 * Returns discovered skills and any validation warnings.
 */
export async function discoverGlobalSkills(): Promise<{ skills: SkillInfo[]; warnings: string[]; globalSkillsDir: string | null }> {
  const globalDir = await findGlobalRulerDir();
  if (!globalDir) {
    return { skills: [], warnings: [], globalSkillsDir: null };
  }

  const globalSkillsDir = path.join(globalDir, SKILLS_DIR);
  try {
    await fs.access(globalSkillsDir);
  } catch {
    return { skills: [], warnings: [], globalSkillsDir: null };
  }

  const result = await walkSkillsTree(globalSkillsDir);
  return { ...result, globalSkillsDir };
}

/**
 * Gets the paths that skills will generate, for gitignore purposes.
 * Returns empty array if skills directory doesn't exist.
 */
export async function getSkillsGitignorePaths(
  projectRoot: string,
  agents: IAgent[],
  localOnly: boolean = false,
): Promise<string[]> {
  const skillsDir = path.join(projectRoot, RULER_SKILLS_PATH);

  // Check if any skills exist (local or global)
  let hasLocalSkills = false;
  let hasGlobalSkills = false;
  try {
    await fs.access(skillsDir);
    hasLocalSkills = true;
  } catch {
    // no local skills
  }
  if (!localOnly) {
    const globalDir = await findGlobalRulerDir();
    if (globalDir) {
      try {
        await fs.access(path.join(globalDir, SKILLS_DIR));
        hasGlobalSkills = true;
      } catch {
        // no global skills
      }
    }
  }

  if (!hasLocalSkills && !hasGlobalSkills) {
    return [];
  }

  // Import here to avoid circular dependency
  const {
    CLAUDE_SKILLS_PATH,
    CODEX_SKILLS_PATH,
    OPENCODE_SKILLS_PATH,
    PI_SKILLS_PATH,
    GOOSE_SKILLS_PATH,
    VIBE_SKILLS_PATH,
    ROO_SKILLS_PATH,
    GEMINI_SKILLS_PATH,
    JUNIE_SKILLS_PATH,
    CURSOR_SKILLS_PATH,
    WINDSURF_SKILLS_PATH,
    FACTORY_SKILLS_PATH,
    ANTIGRAVITY_SKILLS_PATH,
  } = await import('../constants');

  const selectedTargets = getSelectedSkillTargets(agents);
  const targetPaths: Record<SkillTarget, string> = {
    claude: CLAUDE_SKILLS_PATH,
    codex: CODEX_SKILLS_PATH,
    opencode: OPENCODE_SKILLS_PATH,
    pi: PI_SKILLS_PATH,
    goose: GOOSE_SKILLS_PATH,
    vibe: VIBE_SKILLS_PATH,
    roo: ROO_SKILLS_PATH,
    gemini: GEMINI_SKILLS_PATH,
    junie: JUNIE_SKILLS_PATH,
    cursor: CURSOR_SKILLS_PATH,
    windsurf: WINDSURF_SKILLS_PATH,
    factory: FACTORY_SKILLS_PATH,
    antigravity: ANTIGRAVITY_SKILLS_PATH,
  };

  return Array.from(selectedTargets).map((target) =>
    path.join(projectRoot, targetPaths[target]),
  );
}

/**
 * Module-level state to track if experimental warning has been shown.
 * This ensures the warning appears once per process (CLI invocation), not once per apply call.
 * This is intentional: warnings about experimental features should not spam the user
 * if they run multiple applies in the same process or test suite.
 */
let hasWarnedExperimental = false;

/**
 * Warns once per process about experimental skills support.
 * Uses module-level state to prevent duplicate warnings within the same process.
 */
function warnOnceExperimental(verbose: boolean, dryRun: boolean): void {
  if (hasWarnedExperimental) {
    return;
  }
  hasWarnedExperimental = true;
  logWarn(
    'Skills support is experimental and behavior may change in future releases.',
    dryRun,
  );
}

type SkillTarget =
  | 'claude'
  | 'codex'
  | 'opencode'
  | 'pi'
  | 'goose'
  | 'vibe'
  | 'roo'
  | 'gemini'
  | 'junie'
  | 'cursor'
  | 'windsurf'
  | 'factory'
  | 'antigravity';

const SKILL_TARGET_TO_IDENTIFIERS = new Map<SkillTarget, readonly string[]>([
  ['claude', ['claude', 'copilot', 'kilocode']],
  ['codex', ['codex']],
  ['opencode', ['opencode']],
  ['pi', ['pi']],
  ['goose', ['goose', 'amp']],
  ['vibe', ['mistral']],
  ['roo', ['roo']],
  ['gemini', ['gemini-cli']],
  ['junie', ['junie']],
  ['cursor', ['cursor']],
  ['windsurf', ['windsurf']],
  ['factory', ['factory']],
  ['antigravity', ['antigravity']],
]);

function getSelectedSkillTargets(agents: IAgent[]): Set<SkillTarget> {
  const selectedIdentifiers = new Set(
    agents
      .filter((agent) => agent.supportsNativeSkills?.())
      .map((agent) => agent.getIdentifier()),
  );
  const targets = new Set<SkillTarget>();

  for (const [target, identifiers] of SKILL_TARGET_TO_IDENTIFIERS) {
    if (identifiers.some((id) => selectedIdentifiers.has(id))) {
      targets.add(target);
    }
  }

  return targets;
}

/**
 * Cleans up skills directories when skills are disabled.
 * This ensures that stale skills from previous runs don't persist when skills are turned off.
 */
async function cleanupSkillsDirectories(
  projectRoot: string,
  dryRun: boolean,
  verbose: boolean,
): Promise<void> {
  const claudeSkillsPath = path.join(projectRoot, CLAUDE_SKILLS_PATH);
  const codexSkillsPath = path.join(projectRoot, CODEX_SKILLS_PATH);
  const opencodeSkillsPath = path.join(projectRoot, OPENCODE_SKILLS_PATH);
  const piSkillsPath = path.join(projectRoot, PI_SKILLS_PATH);
  const gooseSkillsPath = path.join(projectRoot, GOOSE_SKILLS_PATH);
  const vibeSkillsPath = path.join(projectRoot, VIBE_SKILLS_PATH);
  const rooSkillsPath = path.join(projectRoot, ROO_SKILLS_PATH);
  const geminiSkillsPath = path.join(projectRoot, GEMINI_SKILLS_PATH);
  const junieSkillsPath = path.join(projectRoot, JUNIE_SKILLS_PATH);
  const cursorSkillsPath = path.join(projectRoot, CURSOR_SKILLS_PATH);
  const windsurfSkillsPath = path.join(projectRoot, WINDSURF_SKILLS_PATH);
  const factorySkillsPath = path.join(projectRoot, FACTORY_SKILLS_PATH);
  const antigravitySkillsPath = path.join(projectRoot, ANTIGRAVITY_SKILLS_PATH);

  // Clean up .claude/skills
  try {
    await fs.access(claudeSkillsPath);
    if (dryRun) {
      logVerboseInfo(
        `DRY RUN: Would remove ${CLAUDE_SKILLS_PATH}`,
        verbose,
        dryRun,
      );
    } else {
      await fs.rm(claudeSkillsPath, { recursive: true, force: true });
      logVerboseInfo(
        `Removed ${CLAUDE_SKILLS_PATH} (skills disabled)`,
        verbose,
        dryRun,
      );
    }
  } catch {
    // Directory doesn't exist, nothing to clean
  }

  // Clean up .codex/skills
  try {
    await fs.access(codexSkillsPath);
    if (dryRun) {
      logVerboseInfo(
        `DRY RUN: Would remove ${CODEX_SKILLS_PATH}`,
        verbose,
        dryRun,
      );
    } else {
      await fs.rm(codexSkillsPath, { recursive: true, force: true });
      logVerboseInfo(
        `Removed ${CODEX_SKILLS_PATH} (skills disabled)`,
        verbose,
        dryRun,
      );
    }
  } catch {
    // Directory doesn't exist, nothing to clean
  }

  // Clean up .opencode/skills
  try {
    await fs.access(opencodeSkillsPath);
    if (dryRun) {
      logVerboseInfo(
        `DRY RUN: Would remove ${OPENCODE_SKILLS_PATH}`,
        verbose,
        dryRun,
      );
    } else {
      await fs.rm(opencodeSkillsPath, { recursive: true, force: true });
      logVerboseInfo(
        `Removed ${OPENCODE_SKILLS_PATH} (skills disabled)`,
        verbose,
        dryRun,
      );
    }
  } catch {
    // Directory doesn't exist, nothing to clean
  }

  // Clean up .pi/skills
  try {
    await fs.access(piSkillsPath);
    if (dryRun) {
      logVerboseInfo(
        `DRY RUN: Would remove ${PI_SKILLS_PATH}`,
        verbose,
        dryRun,
      );
    } else {
      await fs.rm(piSkillsPath, { recursive: true, force: true });
      logVerboseInfo(
        `Removed ${PI_SKILLS_PATH} (skills disabled)`,
        verbose,
        dryRun,
      );
    }
  } catch {
    // Directory doesn't exist, nothing to clean
  }

  // Clean up .agents/skills
  try {
    await fs.access(gooseSkillsPath);
    if (dryRun) {
      logVerboseInfo(
        `DRY RUN: Would remove ${GOOSE_SKILLS_PATH}`,
        verbose,
        dryRun,
      );
    } else {
      await fs.rm(gooseSkillsPath, { recursive: true, force: true });
      logVerboseInfo(
        `Removed ${GOOSE_SKILLS_PATH} (skills disabled)`,
        verbose,
        dryRun,
      );
    }
  } catch {
    // Directory doesn't exist, nothing to clean
  }

  // Clean up .vibe/skills
  try {
    await fs.access(vibeSkillsPath);
    if (dryRun) {
      logVerboseInfo(
        `DRY RUN: Would remove ${VIBE_SKILLS_PATH}`,
        verbose,
        dryRun,
      );
    } else {
      await fs.rm(vibeSkillsPath, { recursive: true, force: true });
      logVerboseInfo(
        `Removed ${VIBE_SKILLS_PATH} (skills disabled)`,
        verbose,
        dryRun,
      );
    }
  } catch {
    // Directory doesn't exist, nothing to clean
  }

  // Clean up .roo/skills
  try {
    await fs.access(rooSkillsPath);
    if (dryRun) {
      logVerboseInfo(
        `DRY RUN: Would remove ${ROO_SKILLS_PATH}`,
        verbose,
        dryRun,
      );
    } else {
      await fs.rm(rooSkillsPath, { recursive: true, force: true });
      logVerboseInfo(
        `Removed ${ROO_SKILLS_PATH} (skills disabled)`,
        verbose,
        dryRun,
      );
    }
  } catch {
    // Directory doesn't exist, nothing to clean
  }

  // Clean up .gemini/skills
  try {
    await fs.access(geminiSkillsPath);
    if (dryRun) {
      logVerboseInfo(
        `DRY RUN: Would remove ${GEMINI_SKILLS_PATH}`,
        verbose,
        dryRun,
      );
    } else {
      await fs.rm(geminiSkillsPath, { recursive: true, force: true });
      logVerboseInfo(
        `Removed ${GEMINI_SKILLS_PATH} (skills disabled)`,
        verbose,
        dryRun,
      );
    }
  } catch {
    // Directory doesn't exist, nothing to clean
  }

  // Clean up .junie/skills
  try {
    await fs.access(junieSkillsPath);
    if (dryRun) {
      logVerboseInfo(
        `DRY RUN: Would remove ${JUNIE_SKILLS_PATH}`,
        verbose,
        dryRun,
      );
    } else {
      await fs.rm(junieSkillsPath, { recursive: true, force: true });
      logVerboseInfo(
        `Removed ${JUNIE_SKILLS_PATH} (skills disabled)`,
        verbose,
        dryRun,
      );
    }
  } catch {
    // Directory doesn't exist, nothing to clean
  }

  // Clean up .cursor/skills
  try {
    await fs.access(cursorSkillsPath);
    if (dryRun) {
      logVerboseInfo(
        `DRY RUN: Would remove ${CURSOR_SKILLS_PATH}`,
        verbose,
        dryRun,
      );
    } else {
      await fs.rm(cursorSkillsPath, { recursive: true, force: true });
      logVerboseInfo(
        `Removed ${CURSOR_SKILLS_PATH} (skills disabled)`,
        verbose,
        dryRun,
      );
    }
  } catch {
    // Directory doesn't exist, nothing to clean
  }

  // Clean up .windsurf/skills
  try {
    await fs.access(windsurfSkillsPath);
    if (dryRun) {
      logVerboseInfo(
        `DRY RUN: Would remove ${WINDSURF_SKILLS_PATH}`,
        verbose,
        dryRun,
      );
    } else {
      await fs.rm(windsurfSkillsPath, { recursive: true, force: true });
      logVerboseInfo(
        `Removed ${WINDSURF_SKILLS_PATH} (skills disabled)`,
        verbose,
        dryRun,
      );
    }
  } catch {
    // Directory doesn't exist, nothing to clean
  }

  // Clean up .factory/skills
  try {
    await fs.access(factorySkillsPath);
    if (dryRun) {
      logVerboseInfo(
        `DRY RUN: Would remove ${FACTORY_SKILLS_PATH}`,
        verbose,
        dryRun,
      );
    } else {
      await fs.rm(factorySkillsPath, { recursive: true, force: true });
      logVerboseInfo(
        `Removed ${FACTORY_SKILLS_PATH} (skills disabled)`,
        verbose,
        dryRun,
      );
    }
  } catch {
    // Directory doesn't exist, nothing to clean
  }

  // Clean up .agent/skills
  try {
    await fs.access(antigravitySkillsPath);
    if (dryRun) {
      logVerboseInfo(
        `DRY RUN: Would remove ${ANTIGRAVITY_SKILLS_PATH}`,
        verbose,
        dryRun,
      );
    } else {
      await fs.rm(antigravitySkillsPath, { recursive: true, force: true });
      logVerboseInfo(
        `Removed ${ANTIGRAVITY_SKILLS_PATH} (skills disabled)`,
        verbose,
        dryRun,
      );
    }
  } catch {
    // Directory doesn't exist, nothing to clean
  }
}

/**
 * Propagates skills for agents that need them.
 * Discovers skills from both local (.ruler/skills) and global (~/.config/ruler/skills) directories.
 * When both local and global skills exist, local skills take precedence (override global by name).
 * When localOnly is true, global skills are skipped.
 */
export async function propagateSkills(
  projectRoot: string,
  agents: IAgent[],
  skillsEnabled: boolean,
  verbose: boolean,
  dryRun: boolean,
  localOnly: boolean = false,
): Promise<void> {
  if (!skillsEnabled) {
    logVerboseInfo(
      'Skills support disabled, cleaning up skills directories',
      verbose,
      dryRun,
    );
    // Clean up skills directories when skills are disabled
    await cleanupSkillsDirectories(projectRoot, dryRun, verbose);
    return;
  }

  const localSkillsDir = path.join(projectRoot, RULER_SKILLS_PATH);
  let hasLocalSkills = false;
  let hasGlobalSkills = false;
  let globalSkillsDir: string | null = null;

  // Check if local skills directory exists
  try {
    await fs.access(localSkillsDir);
    hasLocalSkills = true;
  } catch {
    // No local skills directory
  }

  // Check if global skills directory exists (unless --local-only)
  if (!localOnly) {
    const globalResult = await discoverGlobalSkills();
    if (globalResult.globalSkillsDir) {
      hasGlobalSkills = true;
      globalSkillsDir = globalResult.globalSkillsDir;
    }
  }

  if (!hasLocalSkills && !hasGlobalSkills) {
    logVerboseInfo(
      'No skills directory found (checked local .ruler/skills' + (localOnly ? '' : ' and global config') + '), skipping skills propagation',
      verbose,
      dryRun,
    );
    return;
  }

  // Discover and merge skills from both sources
  let allSkills: SkillInfo[] = [];
  let allWarnings: string[] = [];

  if (hasGlobalSkills && globalSkillsDir) {
    const globalResult = await walkSkillsTree(globalSkillsDir);
    allSkills = [...globalResult.skills];
    allWarnings = [...globalResult.warnings];
    if (globalResult.skills.length > 0) {
      logVerboseInfo(
        `Discovered ${globalResult.skills.length} global skill(s) from ${globalSkillsDir}`,
        verbose,
        dryRun,
      );
    }
  }

  if (hasLocalSkills) {
    const localResult = await discoverSkills(projectRoot);
    allWarnings = [...allWarnings, ...localResult.warnings];

    if (localResult.skills.length > 0) {
      logVerboseInfo(
        `Discovered ${localResult.skills.length} local skill(s) from ${RULER_SKILLS_PATH}`,
        verbose,
        dryRun,
      );

      // Local skills override global skills with the same name
      const localNames = new Set(localResult.skills.map((s) => s.name));
      const overridden = allSkills.filter((s) => localNames.has(s.name));
      if (overridden.length > 0) {
        logVerboseInfo(
          `Local skills override ${overridden.length} global skill(s): ${overridden.map((s) => s.name).join(', ')}`,
          verbose,
          dryRun,
        );
      }
      allSkills = allSkills.filter((s) => !localNames.has(s.name));
      allSkills = [...allSkills, ...localResult.skills];
    }
  }

  if (allWarnings.length > 0) {
    allWarnings.forEach((warning) => logWarn(warning, dryRun));
  }

  if (allSkills.length === 0) {
    logVerboseInfo('No valid skills found', verbose, dryRun);
    return;
  }

  logVerboseInfo(`Total: ${allSkills.length} skill(s) to propagate`, verbose, dryRun);

  const hasNativeSkillsAgent = agents.some((a) => a.supportsNativeSkills?.());
  const nonNativeAgents = agents.filter(
    (agent) => !agent.supportsNativeSkills?.(),
  );

  if (nonNativeAgents.length > 0) {
    const agentList = nonNativeAgents
      .map((agent) => agent.getName())
      .join(', ');
    logWarn(
      `Skills are configured, but the following agents do not support native skills and will be skipped: ${agentList}`,
      dryRun,
    );
  }

  if (!hasNativeSkillsAgent) {
    logVerboseInfo(
      'No agents support native skills, skipping skills propagation',
      verbose,
      dryRun,
    );
    return;
  }

  // Warn about experimental features
  warnOnceExperimental(verbose, dryRun);

  const selectedTargets = getSelectedSkillTargets(agents);
  if (selectedTargets.size === 0) {
    logVerboseInfo(
      'No selected agents require skills propagation, skipping skills propagation',
      verbose,
      dryRun,
    );
    return;
  }

  // Build a merged skills source directory if we have both local and global skills.
  // Global skills are copied first, then local skills overwrite (local takes precedence).
  let mergedSkillsDir: string | null = null;
  let effectiveSkillsDir: string;

  if (hasLocalSkills && hasGlobalSkills && globalSkillsDir) {
    // Need to merge: create a temp dir with global first, then local on top
    mergedSkillsDir = path.join(projectRoot, '.ruler', `.skills-merged-${Date.now()}`);
    try {
      await mergeSkillsDirectories(globalSkillsDir, localSkillsDir, mergedSkillsDir);
      effectiveSkillsDir = mergedSkillsDir;
    } catch (error) {
      // Clean up on error
      try { await fs.rm(mergedSkillsDir, { recursive: true, force: true }); } catch { /* ignore */ }
      throw error;
    }
  } else if (hasLocalSkills) {
    effectiveSkillsDir = localSkillsDir;
  } else {
    effectiveSkillsDir = globalSkillsDir!;
  }

  try {
  // Copy to Claude skills directory if needed
  if (selectedTargets.has('claude')) {
    logVerboseInfo(
      `Copying skills to ${CLAUDE_SKILLS_PATH} for Claude Code, GitHub Copilot, and KiloCode`,
      verbose,
      dryRun,
    );
    await propagateSkillsForClaude(projectRoot, { dryRun, skillsSourceDir: effectiveSkillsDir });
  }

  if (selectedTargets.has('codex')) {
    logVerboseInfo(
      `Copying skills to ${CODEX_SKILLS_PATH} for OpenAI Codex CLI`,
      verbose,
      dryRun,
    );
    await propagateSkillsForCodex(projectRoot, { dryRun, skillsSourceDir: effectiveSkillsDir });
  }

  if (selectedTargets.has('opencode')) {
    logVerboseInfo(
      `Copying skills to ${OPENCODE_SKILLS_PATH} for OpenCode`,
      verbose,
      dryRun,
    );
    await propagateSkillsForOpenCode(projectRoot, { dryRun, skillsSourceDir: effectiveSkillsDir });
  }

  if (selectedTargets.has('pi')) {
    logVerboseInfo(
      `Copying skills to ${PI_SKILLS_PATH} for Pi Coding Agent`,
      verbose,
      dryRun,
    );
    await propagateSkillsForPi(projectRoot, { dryRun, skillsSourceDir: effectiveSkillsDir });
  }

  if (selectedTargets.has('goose')) {
    logVerboseInfo(
      `Copying skills to ${GOOSE_SKILLS_PATH} for Goose and Amp`,
      verbose,
      dryRun,
    );
    await propagateSkillsForGoose(projectRoot, { dryRun, skillsSourceDir: effectiveSkillsDir });
  }

  if (selectedTargets.has('vibe')) {
    logVerboseInfo(
      `Copying skills to ${VIBE_SKILLS_PATH} for Mistral Vibe`,
      verbose,
      dryRun,
    );
    await propagateSkillsForVibe(projectRoot, { dryRun, skillsSourceDir: effectiveSkillsDir });
  }

  if (selectedTargets.has('roo')) {
    logVerboseInfo(
      `Copying skills to ${ROO_SKILLS_PATH} for Roo Code`,
      verbose,
      dryRun,
    );
    await propagateSkillsForRoo(projectRoot, { dryRun, skillsSourceDir: effectiveSkillsDir });
  }

  if (selectedTargets.has('gemini')) {
    logVerboseInfo(
      `Copying skills to ${GEMINI_SKILLS_PATH} for Gemini CLI`,
      verbose,
      dryRun,
    );
    await propagateSkillsForGemini(projectRoot, { dryRun, skillsSourceDir: effectiveSkillsDir });
  }

  if (selectedTargets.has('junie')) {
    logVerboseInfo(
      `Copying skills to ${JUNIE_SKILLS_PATH} for Junie`,
      verbose,
      dryRun,
    );
    await propagateSkillsForJunie(projectRoot, { dryRun, skillsSourceDir: effectiveSkillsDir });
  }

  if (selectedTargets.has('cursor')) {
    logVerboseInfo(
      `Copying skills to ${CURSOR_SKILLS_PATH} for Cursor`,
      verbose,
      dryRun,
    );
    await propagateSkillsForCursor(projectRoot, { dryRun, skillsSourceDir: effectiveSkillsDir });
  }

  if (selectedTargets.has('windsurf')) {
    logVerboseInfo(
      `Copying skills to ${WINDSURF_SKILLS_PATH} for Windsurf`,
      verbose,
      dryRun,
    );
    await propagateSkillsForWindsurf(projectRoot, { dryRun, skillsSourceDir: effectiveSkillsDir });
  }

  if (selectedTargets.has('factory')) {
    logVerboseInfo(
      `Copying skills to ${FACTORY_SKILLS_PATH} for Factory Droid`,
      verbose,
      dryRun,
    );
    await propagateSkillsForFactory(projectRoot, { dryRun, skillsSourceDir: effectiveSkillsDir });
  }

  if (selectedTargets.has('antigravity')) {
    logVerboseInfo(
      `Copying skills to ${ANTIGRAVITY_SKILLS_PATH} for Antigravity`,
      verbose,
      dryRun,
    );
    await propagateSkillsForAntigravity(projectRoot, { dryRun, skillsSourceDir: effectiveSkillsDir });
  }

  // No MCP-based propagation; only native skills are supported.
  } finally {
    // Clean up merged temp directory if we created one
    if (mergedSkillsDir) {
      try { await fs.rm(mergedSkillsDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
}

/**
 * Propagates skills for Claude Code by copying .ruler/skills to .claude/skills.
 * Uses atomic replace to ensure safe overwriting of existing skills.
 * Returns dry-run steps if dryRun is true, otherwise returns empty array.
 */
export async function propagateSkillsForClaude(
  projectRoot: string,
  options: { dryRun: boolean; skillsSourceDir?: string },
): Promise<string[]> {
  const skillsDir = options.skillsSourceDir || path.join(projectRoot, RULER_SKILLS_PATH);
  const claudeSkillsPath = path.join(projectRoot, CLAUDE_SKILLS_PATH);
  const claudeDir = path.dirname(claudeSkillsPath);

  // Check if source skills directory exists
  try {
    await fs.access(skillsDir);
  } catch {
    // No skills directory - return empty
    return [];
  }

  if (options.dryRun) {
    return [`Copy skills from ${RULER_SKILLS_PATH} to ${CLAUDE_SKILLS_PATH}`];
  }

  // Ensure .claude directory exists
  await fs.mkdir(claudeDir, { recursive: true });

  // Use atomic replace: copy to temp, then rename
  const tempDir = path.join(claudeDir, `skills.tmp-${Date.now()}`);

  try {
    // Copy to temp directory
    await copySkillsDirectory(skillsDir, tempDir);

    // Atomically replace the target
    // First, remove existing target if it exists
    try {
      await fs.rm(claudeSkillsPath, { recursive: true, force: true });
    } catch {
      // Target didn't exist, that's fine
    }

    // Rename temp to target
    await fs.rename(tempDir, claudeSkillsPath);
  } catch (error) {
    // Clean up temp directory on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }

  return [];
}

/**
 * Propagates skills for OpenAI Codex CLI by copying .ruler/skills to .codex/skills.
 * Uses atomic replace to ensure safe overwriting of existing skills.
 * Returns dry-run steps if dryRun is true, otherwise returns empty array.
 */
export async function propagateSkillsForCodex(
  projectRoot: string,
  options: { dryRun: boolean; skillsSourceDir?: string },
): Promise<string[]> {
  const skillsDir = options.skillsSourceDir || path.join(projectRoot, RULER_SKILLS_PATH);
  const codexSkillsPath = path.join(projectRoot, CODEX_SKILLS_PATH);
  const codexDir = path.dirname(codexSkillsPath);

  // Check if source skills directory exists
  try {
    await fs.access(skillsDir);
  } catch {
    // No skills directory - return empty
    return [];
  }

  if (options.dryRun) {
    return [`Copy skills from ${RULER_SKILLS_PATH} to ${CODEX_SKILLS_PATH}`];
  }

  // Ensure .codex directory exists
  await fs.mkdir(codexDir, { recursive: true });

  // Use atomic replace: copy to temp, then rename
  const tempDir = path.join(codexDir, `skills.tmp-${Date.now()}`);

  try {
    // Copy to temp directory
    await copySkillsDirectory(skillsDir, tempDir);

    // Atomically replace the target
    // First, remove existing target if it exists
    try {
      await fs.rm(codexSkillsPath, { recursive: true, force: true });
    } catch {
      // Target didn't exist, that's fine
    }

    // Rename temp to target
    await fs.rename(tempDir, codexSkillsPath);
  } catch (error) {
    // Clean up temp directory on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }

  return [];
}

/**
 * Propagates skills for OpenCode by copying .ruler/skills to .opencode/skills.
 * Uses atomic replace to ensure safe overwriting of existing skills.
 * Returns dry-run steps if dryRun is true, otherwise returns empty array.
 */
export async function propagateSkillsForOpenCode(
  projectRoot: string,
  options: { dryRun: boolean; skillsSourceDir?: string },
): Promise<string[]> {
  const skillsDir = options.skillsSourceDir || path.join(projectRoot, RULER_SKILLS_PATH);
  const opencodeSkillsPath = path.join(projectRoot, OPENCODE_SKILLS_PATH);
  const opencodeDir = path.dirname(opencodeSkillsPath);

  // Check if source skills directory exists
  try {
    await fs.access(skillsDir);
  } catch {
    // No skills directory - return empty
    return [];
  }

  if (options.dryRun) {
    return [`Copy skills from ${RULER_SKILLS_PATH} to ${OPENCODE_SKILLS_PATH}`];
  }

  // Ensure .opencode directory exists
  await fs.mkdir(opencodeDir, { recursive: true });

  // Use atomic replace: copy to temp, then rename
  const tempDir = path.join(opencodeDir, `skill.tmp-${Date.now()}`);

  try {
    // Copy to temp directory
    await copySkillsDirectory(skillsDir, tempDir);

    // Atomically replace the target
    // First, remove existing target if it exists
    try {
      await fs.rm(opencodeSkillsPath, { recursive: true, force: true });
    } catch {
      // Target didn't exist, that's fine
    }

    // Rename temp to target
    await fs.rename(tempDir, opencodeSkillsPath);
  } catch (error) {
    // Clean up temp directory on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }

  return [];
}

/**
 * Propagates skills for Pi Coding Agent by copying .ruler/skills to .pi/skills.
 * Uses atomic replace to ensure safe overwriting of existing skills.
 * Returns dry-run steps if dryRun is true, otherwise returns empty array.
 */
export async function propagateSkillsForPi(
  projectRoot: string,
  options: { dryRun: boolean; skillsSourceDir?: string },
): Promise<string[]> {
  const skillsDir = options.skillsSourceDir || path.join(projectRoot, RULER_SKILLS_PATH);
  const piSkillsPath = path.join(projectRoot, PI_SKILLS_PATH);
  const piDir = path.dirname(piSkillsPath);

  // Check if source skills directory exists
  try {
    await fs.access(skillsDir);
  } catch {
    // No skills directory - return empty
    return [];
  }

  if (options.dryRun) {
    return [`Copy skills from ${RULER_SKILLS_PATH} to ${PI_SKILLS_PATH}`];
  }

  // Ensure .pi directory exists
  await fs.mkdir(piDir, { recursive: true });

  // Use atomic replace: copy to temp, then rename
  const tempDir = path.join(piDir, `skills.tmp-${Date.now()}`);

  try {
    // Copy to temp directory
    await copySkillsDirectory(skillsDir, tempDir);

    // Atomically replace the target
    // First, remove existing target if it exists
    try {
      await fs.rm(piSkillsPath, { recursive: true, force: true });
    } catch {
      // Target didn't exist, that's fine
    }

    // Rename temp to target
    await fs.rename(tempDir, piSkillsPath);
  } catch (error) {
    // Clean up temp directory on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }

  return [];
}

/**
 * Propagates skills for Goose by copying .ruler/skills to .agents/skills.
 * Uses atomic replace to ensure safe overwriting of existing skills.
 * Returns dry-run steps if dryRun is true, otherwise returns empty array.
 */
export async function propagateSkillsForGoose(
  projectRoot: string,
  options: { dryRun: boolean; skillsSourceDir?: string },
): Promise<string[]> {
  const skillsDir = options.skillsSourceDir || path.join(projectRoot, RULER_SKILLS_PATH);
  const gooseSkillsPath = path.join(projectRoot, GOOSE_SKILLS_PATH);
  const gooseDir = path.dirname(gooseSkillsPath);

  // Check if source skills directory exists
  try {
    await fs.access(skillsDir);
  } catch {
    // No skills directory - return empty
    return [];
  }

  if (options.dryRun) {
    return [`Copy skills from ${RULER_SKILLS_PATH} to ${GOOSE_SKILLS_PATH}`];
  }

  // Ensure .agents directory exists
  await fs.mkdir(gooseDir, { recursive: true });

  // Use atomic replace: copy to temp, then rename
  const tempDir = path.join(gooseDir, `skills.tmp-${Date.now()}`);

  try {
    // Copy to temp directory
    await copySkillsDirectory(skillsDir, tempDir);

    // Atomically replace the target
    // First, remove existing target if it exists
    try {
      await fs.rm(gooseSkillsPath, { recursive: true, force: true });
    } catch {
      // Target didn't exist, that's fine
    }

    // Rename temp to target
    await fs.rename(tempDir, gooseSkillsPath);
  } catch (error) {
    // Clean up temp directory on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }

  return [];
}

/**
 * Propagates skills for Mistral Vibe by copying .ruler/skills to .vibe/skills.
 * Uses atomic replace to ensure safe overwriting of existing skills.
 * Returns dry-run steps if dryRun is true, otherwise returns empty array.
 */
export async function propagateSkillsForVibe(
  projectRoot: string,
  options: { dryRun: boolean; skillsSourceDir?: string },
): Promise<string[]> {
  const skillsDir = options.skillsSourceDir || path.join(projectRoot, RULER_SKILLS_PATH);
  const vibeSkillsPath = path.join(projectRoot, VIBE_SKILLS_PATH);
  const vibeDir = path.dirname(vibeSkillsPath);

  // Check if source skills directory exists
  try {
    await fs.access(skillsDir);
  } catch {
    // No skills directory - return empty
    return [];
  }

  if (options.dryRun) {
    return [`Copy skills from ${RULER_SKILLS_PATH} to ${VIBE_SKILLS_PATH}`];
  }

  // Ensure .vibe directory exists
  await fs.mkdir(vibeDir, { recursive: true });

  // Use atomic replace: copy to temp, then rename
  const tempDir = path.join(vibeDir, `skills.tmp-${Date.now()}`);

  try {
    // Copy to temp directory
    await copySkillsDirectory(skillsDir, tempDir);

    // Atomically replace the target
    // First, remove existing target if it exists
    try {
      await fs.rm(vibeSkillsPath, { recursive: true, force: true });
    } catch {
      // Target didn't exist, that's fine
    }

    // Rename temp to target
    await fs.rename(tempDir, vibeSkillsPath);
  } catch (error) {
    // Clean up temp directory on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }

  return [];
}

/**
 * Propagates skills for Roo Code by copying .ruler/skills to .roo/skills.
 * Uses atomic replace to ensure safe overwriting of existing skills.
 * Returns dry-run steps if dryRun is true, otherwise returns empty array.
 */
export async function propagateSkillsForRoo(
  projectRoot: string,
  options: { dryRun: boolean; skillsSourceDir?: string },
): Promise<string[]> {
  const skillsDir = options.skillsSourceDir || path.join(projectRoot, RULER_SKILLS_PATH);
  const rooSkillsPath = path.join(projectRoot, ROO_SKILLS_PATH);
  const rooDir = path.dirname(rooSkillsPath);

  // Check if source skills directory exists
  try {
    await fs.access(skillsDir);
  } catch {
    // No skills directory - return empty
    return [];
  }

  if (options.dryRun) {
    return [`Copy skills from ${RULER_SKILLS_PATH} to ${ROO_SKILLS_PATH}`];
  }

  // Ensure .roo directory exists
  await fs.mkdir(rooDir, { recursive: true });

  // Use atomic replace: copy to temp, then rename
  const tempDir = path.join(rooDir, `skills.tmp-${Date.now()}`);

  try {
    // Copy to temp directory
    await copySkillsDirectory(skillsDir, tempDir);

    // Atomically replace the target
    // First, remove existing target if it exists
    try {
      await fs.rm(rooSkillsPath, { recursive: true, force: true });
    } catch {
      // Target didn't exist, that's fine
    }

    // Rename temp to target
    await fs.rename(tempDir, rooSkillsPath);
  } catch (error) {
    // Clean up temp directory on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }

  return [];
}

/**
 * Propagates skills for Gemini CLI by copying .ruler/skills to .gemini/skills.
 * Uses atomic replace to ensure safe overwriting of existing skills.
 * Returns dry-run steps if dryRun is true, otherwise returns empty array.
 */
export async function propagateSkillsForGemini(
  projectRoot: string,
  options: { dryRun: boolean; skillsSourceDir?: string },
): Promise<string[]> {
  const skillsDir = options.skillsSourceDir || path.join(projectRoot, RULER_SKILLS_PATH);
  const geminiSkillsPath = path.join(projectRoot, GEMINI_SKILLS_PATH);
  const geminiDir = path.dirname(geminiSkillsPath);

  // Check if source skills directory exists
  try {
    await fs.access(skillsDir);
  } catch {
    // No skills directory - return empty
    return [];
  }

  if (options.dryRun) {
    return [`Copy skills from ${RULER_SKILLS_PATH} to ${GEMINI_SKILLS_PATH}`];
  }

  // Ensure .gemini directory exists
  await fs.mkdir(geminiDir, { recursive: true });

  // Use atomic replace: copy to temp, then rename
  const tempDir = path.join(geminiDir, `skills.tmp-${Date.now()}`);

  try {
    // Copy to temp directory
    await copySkillsDirectory(skillsDir, tempDir);

    // Atomically replace the target
    // First, remove existing target if it exists
    try {
      await fs.rm(geminiSkillsPath, { recursive: true, force: true });
    } catch {
      // Target didn't exist, that's fine
    }

    // Rename temp to target
    await fs.rename(tempDir, geminiSkillsPath);
  } catch (error) {
    // Clean up temp directory on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }

  return [];
}

/**
 * Propagates skills for Junie by copying .ruler/skills to .junie/skills.
 * Uses atomic replace to ensure safe overwriting of existing skills.
 * Returns dry-run steps if dryRun is true, otherwise returns empty array.
 */
export async function propagateSkillsForJunie(
  projectRoot: string,
  options: { dryRun: boolean; skillsSourceDir?: string },
): Promise<string[]> {
  const skillsDir = options.skillsSourceDir || path.join(projectRoot, RULER_SKILLS_PATH);
  const junieSkillsPath = path.join(projectRoot, JUNIE_SKILLS_PATH);
  const junieDir = path.dirname(junieSkillsPath);

  try {
    await fs.access(skillsDir);
  } catch {
    return [];
  }

  if (options.dryRun) {
    return [`Copy skills from ${RULER_SKILLS_PATH} to ${JUNIE_SKILLS_PATH}`];
  }

  await fs.mkdir(junieDir, { recursive: true });

  const tempDir = path.join(junieDir, `skills.tmp-${Date.now()}`);

  try {
    await copySkillsDirectory(skillsDir, tempDir);

    try {
      await fs.rm(junieSkillsPath, { recursive: true, force: true });
    } catch {
      // Target didn't exist, that's fine
    }

    await fs.rename(tempDir, junieSkillsPath);
  } catch (error) {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }

  return [];
}

/**
 * Propagates skills for Cursor by copying .ruler/skills to .cursor/skills.
 * Uses atomic replace to ensure safe overwriting of existing skills.
 * Returns dry-run steps if dryRun is true, otherwise returns empty array.
 */
export async function propagateSkillsForCursor(
  projectRoot: string,
  options: { dryRun: boolean; skillsSourceDir?: string },
): Promise<string[]> {
  const skillsDir = options.skillsSourceDir || path.join(projectRoot, RULER_SKILLS_PATH);
  const cursorSkillsPath = path.join(projectRoot, CURSOR_SKILLS_PATH);
  const cursorDir = path.dirname(cursorSkillsPath);

  // Check if source skills directory exists
  try {
    await fs.access(skillsDir);
  } catch {
    // No skills directory - return empty
    return [];
  }

  if (options.dryRun) {
    return [`Copy skills from ${RULER_SKILLS_PATH} to ${CURSOR_SKILLS_PATH}`];
  }

  // Ensure .cursor directory exists
  await fs.mkdir(cursorDir, { recursive: true });

  // Use atomic replace: copy to temp, then rename
  const tempDir = path.join(cursorDir, `skills.tmp-${Date.now()}`);

  try {
    // Copy to temp directory
    await copySkillsDirectory(skillsDir, tempDir);

    // Atomically replace the target
    // First, remove existing target if it exists
    try {
      await fs.rm(cursorSkillsPath, { recursive: true, force: true });
    } catch {
      // Target didn't exist, that's fine
    }

    // Rename temp to target
    await fs.rename(tempDir, cursorSkillsPath);
  } catch (error) {
    // Clean up temp directory on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }

  return [];
}

/**
 * Propagates skills for Windsurf by copying .ruler/skills to .windsurf/skills.
 * Uses atomic replace to ensure safe overwriting of existing skills.
 * Returns dry-run steps if dryRun is true, otherwise returns empty array.
 */
export async function propagateSkillsForWindsurf(
  projectRoot: string,
  options: { dryRun: boolean; skillsSourceDir?: string },
): Promise<string[]> {
  const skillsDir = options.skillsSourceDir || path.join(projectRoot, RULER_SKILLS_PATH);
  const windsurfSkillsPath = path.join(projectRoot, WINDSURF_SKILLS_PATH);
  const windsurfDir = path.dirname(windsurfSkillsPath);

  // Check if source skills directory exists
  try {
    await fs.access(skillsDir);
  } catch {
    // No skills directory - return empty
    return [];
  }

  if (options.dryRun) {
    return [`Copy skills from ${RULER_SKILLS_PATH} to ${WINDSURF_SKILLS_PATH}`];
  }

  // Ensure .windsurf directory exists
  await fs.mkdir(windsurfDir, { recursive: true });

  // Use atomic replace: copy to temp, then rename
  const tempDir = path.join(windsurfDir, `skills.tmp-${Date.now()}`);

  try {
    // Copy to temp directory
    await copySkillsDirectory(skillsDir, tempDir);

    // Atomically replace the target
    // First, remove existing target if it exists
    try {
      await fs.rm(windsurfSkillsPath, { recursive: true, force: true });
    } catch {
      // Target didn't exist, that's fine
    }

    // Rename temp to target
    await fs.rename(tempDir, windsurfSkillsPath);
  } catch (error) {
    // Clean up temp directory on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }

  return [];
}

/**
 * Propagates skills for Factory Droid by copying .ruler/skills to .factory/skills.
 * Uses atomic replace to ensure safe overwriting of existing skills.
 * Returns dry-run steps if dryRun is true, otherwise returns empty array.
 */
export async function propagateSkillsForFactory(
  projectRoot: string,
  options: { dryRun: boolean; skillsSourceDir?: string },
): Promise<string[]> {
  const skillsDir = options.skillsSourceDir || path.join(projectRoot, RULER_SKILLS_PATH);
  const factorySkillsPath = path.join(projectRoot, FACTORY_SKILLS_PATH);
  const factoryDir = path.dirname(factorySkillsPath);

  // Check if source skills directory exists
  try {
    await fs.access(skillsDir);
  } catch {
    // No skills directory - return empty
    return [];
  }

  if (options.dryRun) {
    return [`Copy skills from ${RULER_SKILLS_PATH} to ${FACTORY_SKILLS_PATH}`];
  }

  // Ensure .factory directory exists
  await fs.mkdir(factoryDir, { recursive: true });

  // Use atomic replace: copy to temp, then rename
  const tempDir = path.join(factoryDir, `skills.tmp-${Date.now()}`);

  try {
    // Copy to temp directory
    await copySkillsDirectory(skillsDir, tempDir);

    // Atomically replace the target
    // First, remove existing target if it exists
    try {
      await fs.rm(factorySkillsPath, { recursive: true, force: true });
    } catch {
      // Target didn't exist, that's fine
    }

    // Rename temp to target
    await fs.rename(tempDir, factorySkillsPath);
  } catch (error) {
    // Clean up temp directory on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }

  return [];
}

/**
 * Propagates skills for Antigravity by copying .ruler/skills to .agent/skills.
 * Uses atomic replace to ensure safe overwriting of existing skills.
 * Returns dry-run steps if dryRun is true, otherwise returns empty array.
 */
export async function propagateSkillsForAntigravity(
  projectRoot: string,
  options: { dryRun: boolean; skillsSourceDir?: string },
): Promise<string[]> {
  const skillsDir = options.skillsSourceDir || path.join(projectRoot, RULER_SKILLS_PATH);
  const antigravitySkillsPath = path.join(projectRoot, ANTIGRAVITY_SKILLS_PATH);
  const antigravityDir = path.dirname(antigravitySkillsPath);

  // Check if source skills directory exists
  try {
    await fs.access(skillsDir);
  } catch {
    // No skills directory - return empty
    return [];
  }

  if (options.dryRun) {
    return [
      `Copy skills from ${RULER_SKILLS_PATH} to ${ANTIGRAVITY_SKILLS_PATH}`,
    ];
  }

  // Ensure .agent directory exists
  await fs.mkdir(antigravityDir, { recursive: true });

  // Use atomic replace: copy to temp, then rename
  const tempDir = path.join(antigravityDir, `skills.tmp-${Date.now()}`);

  try {
    // Copy to temp directory
    await copySkillsDirectory(skillsDir, tempDir);

    // Atomically replace the target
    // First, remove existing target if it exists
    try {
      await fs.rm(antigravitySkillsPath, { recursive: true, force: true });
    } catch {
      // Target didn't exist, that's fine
    }

    // Rename temp to target
    await fs.rename(tempDir, antigravitySkillsPath);
  } catch (error) {
    // Clean up temp directory on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }

  return [];
}
