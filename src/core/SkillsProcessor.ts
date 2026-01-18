import * as path from 'path';
import * as fs from 'fs/promises';
import { SkillInfo } from '../types';
import {
  RULER_SKILLS_PATH,
  CLAUDE_SKILLS_PATH,
  CODEX_SKILLS_PATH,
  OPENCODE_SKILLS_PATH,
  PI_SKILLS_PATH,
  GOOSE_SKILLS_PATH,
  VIBE_SKILLS_PATH,
  ROO_SKILLS_PATH,
  GEMINI_SKILLS_PATH,
  CURSOR_SKILLS_PATH,
  ANTIGRAVITY_SKILLS_PATH,
  logWarn,
  logVerboseInfo,
} from '../constants';
import { walkSkillsTree, copySkillsDirectory } from './SkillsUtils';
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
 * Gets the paths that skills will generate, for gitignore purposes.
 * Returns empty array if skills directory doesn't exist.
 */
export async function getSkillsGitignorePaths(
  projectRoot: string,
): Promise<string[]> {
  const skillsDir = path.join(projectRoot, RULER_SKILLS_PATH);

  // Check if skills directory exists
  try {
    await fs.access(skillsDir);
  } catch {
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
    CURSOR_SKILLS_PATH,
    ANTIGRAVITY_SKILLS_PATH,
  } = await import('../constants');

  return [
    path.join(projectRoot, CLAUDE_SKILLS_PATH),
    path.join(projectRoot, CODEX_SKILLS_PATH),
    path.join(projectRoot, OPENCODE_SKILLS_PATH),
    path.join(projectRoot, PI_SKILLS_PATH),
    path.join(projectRoot, GOOSE_SKILLS_PATH),
    path.join(projectRoot, VIBE_SKILLS_PATH),
    path.join(projectRoot, ROO_SKILLS_PATH),
    path.join(projectRoot, GEMINI_SKILLS_PATH),
    path.join(projectRoot, CURSOR_SKILLS_PATH),
    path.join(projectRoot, ANTIGRAVITY_SKILLS_PATH),
  ];
}

/**
 * Module-level state to track if experimental warning has been shown.
 * This ensures the warning appears once per process (CLI invocation), not once per apply call.
 * This is intentional: warnings about experimental features should not spam the user
 * if they run multiple applies in the same process or test suite.
 */
let hasWarnedExperimental = false;

/**
 * Warns once per process about experimental skills features.
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
  const cursorSkillsPath = path.join(projectRoot, CURSOR_SKILLS_PATH);
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

  // Clean up .opencode/skill
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
 */
export async function propagateSkills(
  projectRoot: string,
  agents: IAgent[],
  skillsEnabled: boolean,
  verbose: boolean,
  dryRun: boolean,
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

  const skillsDir = path.join(projectRoot, RULER_SKILLS_PATH);

  // Check if skills directory exists
  try {
    await fs.access(skillsDir);
  } catch {
    // No skills directory - this is fine
    logVerboseInfo(
      'No .ruler/skills directory found, skipping skills propagation',
      verbose,
      dryRun,
    );
    return;
  }

  // Discover skills
  const { skills, warnings } = await discoverSkills(projectRoot);

  if (warnings.length > 0) {
    warnings.forEach((warning) => logWarn(warning, dryRun));
  }

  if (skills.length === 0) {
    logVerboseInfo('No valid skills found in .ruler/skills', verbose, dryRun);
    return;
  }

  logVerboseInfo(`Discovered ${skills.length} skill(s)`, verbose, dryRun);

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

  // Copy to Claude skills directory if needed
  if (hasNativeSkillsAgent) {
    logVerboseInfo(
      `Copying skills to ${CLAUDE_SKILLS_PATH} for Claude Code, GitHub Copilot, and Kilo Code`,
      verbose,
      dryRun,
    );
    await propagateSkillsForClaude(projectRoot, { dryRun });

    logVerboseInfo(
      `Copying skills to ${CODEX_SKILLS_PATH} for OpenAI Codex CLI`,
      verbose,
      dryRun,
    );
    await propagateSkillsForCodex(projectRoot, { dryRun });

    logVerboseInfo(
      `Copying skills to ${OPENCODE_SKILLS_PATH} for OpenCode`,
      verbose,
      dryRun,
    );
    await propagateSkillsForOpenCode(projectRoot, { dryRun });

    logVerboseInfo(
      `Copying skills to ${PI_SKILLS_PATH} for Pi Coding Agent`,
      verbose,
      dryRun,
    );
    await propagateSkillsForPi(projectRoot, { dryRun });

    logVerboseInfo(
      `Copying skills to ${GOOSE_SKILLS_PATH} for Goose and Amp`,
      verbose,
      dryRun,
    );
    await propagateSkillsForGoose(projectRoot, { dryRun });

    logVerboseInfo(
      `Copying skills to ${VIBE_SKILLS_PATH} for Mistral Vibe`,
      verbose,
      dryRun,
    );
    await propagateSkillsForVibe(projectRoot, { dryRun });

    logVerboseInfo(
      `Copying skills to ${ROO_SKILLS_PATH} for Roo Code`,
      verbose,
      dryRun,
    );
    await propagateSkillsForRoo(projectRoot, { dryRun });

    logVerboseInfo(
      `Copying skills to ${GEMINI_SKILLS_PATH} for Gemini CLI`,
      verbose,
      dryRun,
    );
    await propagateSkillsForGemini(projectRoot, { dryRun });

    logVerboseInfo(
      `Copying skills to ${CURSOR_SKILLS_PATH} for Cursor`,
      verbose,
      dryRun,
    );
    await propagateSkillsForCursor(projectRoot, { dryRun });

    logVerboseInfo(
      `Copying skills to ${ANTIGRAVITY_SKILLS_PATH} for Antigravity`,
      verbose,
      dryRun,
    );
    await propagateSkillsForAntigravity(projectRoot, { dryRun });
  }

  // No MCP-based propagation; only native skills are supported.
}

/**
 * Propagates skills for Claude Code by copying .ruler/skills to .claude/skills.
 * Uses atomic replace to ensure safe overwriting of existing skills.
 * Returns dry-run steps if dryRun is true, otherwise returns empty array.
 */
export async function propagateSkillsForClaude(
  projectRoot: string,
  options: { dryRun: boolean },
): Promise<string[]> {
  const skillsDir = path.join(projectRoot, RULER_SKILLS_PATH);
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
  options: { dryRun: boolean },
): Promise<string[]> {
  const skillsDir = path.join(projectRoot, RULER_SKILLS_PATH);
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
 * Propagates skills for OpenCode by copying .ruler/skills to .opencode/skill.
 * Uses atomic replace to ensure safe overwriting of existing skills.
 * Returns dry-run steps if dryRun is true, otherwise returns empty array.
 */
export async function propagateSkillsForOpenCode(
  projectRoot: string,
  options: { dryRun: boolean },
): Promise<string[]> {
  const skillsDir = path.join(projectRoot, RULER_SKILLS_PATH);
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
  options: { dryRun: boolean },
): Promise<string[]> {
  const skillsDir = path.join(projectRoot, RULER_SKILLS_PATH);
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
  options: { dryRun: boolean },
): Promise<string[]> {
  const skillsDir = path.join(projectRoot, RULER_SKILLS_PATH);
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
  options: { dryRun: boolean },
): Promise<string[]> {
  const skillsDir = path.join(projectRoot, RULER_SKILLS_PATH);
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
  options: { dryRun: boolean },
): Promise<string[]> {
  const skillsDir = path.join(projectRoot, RULER_SKILLS_PATH);
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
  options: { dryRun: boolean },
): Promise<string[]> {
  const skillsDir = path.join(projectRoot, RULER_SKILLS_PATH);
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
 * Propagates skills for Cursor by copying .ruler/skills to .cursor/skills.
 * Uses atomic replace to ensure safe overwriting of existing skills.
 * Returns dry-run steps if dryRun is true, otherwise returns empty array.
 */
export async function propagateSkillsForCursor(
  projectRoot: string,
  options: { dryRun: boolean },
): Promise<string[]> {
  const skillsDir = path.join(projectRoot, RULER_SKILLS_PATH);
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
 * Propagates skills for Antigravity by copying .ruler/skills to .agent/skills.
 * Uses atomic replace to ensure safe overwriting of existing skills.
 * Returns dry-run steps if dryRun is true, otherwise returns empty array.
 */
export async function propagateSkillsForAntigravity(
  projectRoot: string,
  options: { dryRun: boolean },
): Promise<string[]> {
  const skillsDir = path.join(projectRoot, RULER_SKILLS_PATH);
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
