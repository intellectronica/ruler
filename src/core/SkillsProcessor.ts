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
  SKILLZ_DIR,
  SKILLZ_MCP_SERVER_NAME,
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
 * Only returns paths for agents that are actually selected.
 * Returns empty array if skills directory doesn't exist.
 */
export async function getSkillsGitignorePaths(
  projectRoot: string,
  agents: IAgent[],
): Promise<string[]> {
  const skillsDir = path.join(projectRoot, RULER_SKILLS_PATH);

  // Check if skills directory exists
  try {
    await fs.access(skillsDir);
  } catch {
    return [];
  }

  const paths: string[] = [];
  const addedPaths = new Set<string>();

  // Add paths based on selected agents
  for (const agent of agents) {
    // Use the agent's getNativeSkillsPath method if available
    const skillsPath = agent.getNativeSkillsPath?.(projectRoot);
    if (skillsPath && !addedPaths.has(skillsPath)) {
      paths.push(skillsPath);
      addedPaths.add(skillsPath);
    }

    // Check if agent needs MCP (Skillz directory)
    if (agent.supportsMcpStdio?.() && !agent.supportsNativeSkills?.()) {
      const skillzPath = path.join(projectRoot, SKILLZ_DIR);
      if (!addedPaths.has(skillzPath)) {
        paths.push(skillzPath);
        addedPaths.add(skillzPath);
      }
    }
  }

  return paths;
}

/**
 * Module-level state to track if experimental warning has been shown.
 * This ensures the warning appears once per process (CLI invocation), not once per apply call.
 * This is intentional: warnings about experimental features should not spam the user
 * if they run multiple applies in the same process or test suite.
 */
let hasWarnedExperimental = false;

/**
 * Warns once per process about experimental skills features and uv requirement.
 * Uses module-level state to prevent duplicate warnings within the same process.
 */
function warnOnceExperimentalAndUv(verbose: boolean, dryRun: boolean): void {
  if (hasWarnedExperimental) {
    return;
  }
  hasWarnedExperimental = true;
  logWarn(
    'Skills support is experimental and behavior may change in future releases.',
    dryRun,
  );
  logWarn(
    'Skills MCP server (Skillz) requires uv. Install: https://github.com/astral-sh/uv',
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
  const skillzPath = path.join(projectRoot, SKILLZ_DIR);

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

  // Clean up .skillz
  try {
    await fs.access(skillzPath);
    if (dryRun) {
      logVerboseInfo(`DRY RUN: Would remove ${SKILLZ_DIR}`, verbose, dryRun);
    } else {
      await fs.rm(skillzPath, { recursive: true, force: true });
      logVerboseInfo(
        `Removed ${SKILLZ_DIR} (skills disabled)`,
        verbose,
        dryRun,
      );
    }
  } catch {
    // Directory doesn't exist, nothing to clean
  }
}

/**
 * Generic function to propagate skills to any target path.
 * Uses atomic replace to ensure safe overwriting of existing skills.
 */
async function propagateSkillsToPath(
  projectRoot: string,
  targetPath: string,
  options: { dryRun: boolean },
): Promise<void> {
  const skillsDir = path.join(projectRoot, RULER_SKILLS_PATH);
  const targetDir = path.dirname(targetPath);

  // Check if source skills directory exists
  try {
    await fs.access(skillsDir);
  } catch {
    // No skills directory - return
    return;
  }

  if (options.dryRun) {
    return;
  }

  // Ensure target parent directory exists
  await fs.mkdir(targetDir, { recursive: true });

  // Use atomic replace: copy to temp, then rename
  const tempDir = path.join(targetDir, `skills.tmp-${Date.now()}`);

  try {
    // Copy to temp directory
    await copySkillsDirectory(skillsDir, tempDir);

    // Atomically replace the target
    // First, remove existing target if it exists
    try {
      await fs.rm(targetPath, { recursive: true, force: true });
    } catch {
      // Target didn't exist, that's fine
    }

    // Rename temp to target
    await fs.rename(tempDir, targetPath);
  } catch (error) {
    // Clean up temp directory on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    throw error;
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

  // Check if any agents need skills
  const hasNativeSkillsAgent = agents.some((a) => a.supportsNativeSkills?.());
  const hasMcpAgent = agents.some(
    (a) => a.supportsMcpStdio?.() && !a.supportsNativeSkills?.(),
  );

  if (!hasNativeSkillsAgent && !hasMcpAgent) {
    logVerboseInfo('No agents require skills support', verbose, dryRun);
    return;
  }

  // Warn about experimental features
  if (hasMcpAgent) {
    warnOnceExperimentalAndUv(verbose, dryRun);
  }

  // Copy to agent-specific skills directories based on selected agents
  // Track which paths we've already propagated to (some agents share paths)
  const propagatedPaths = new Set<string>();

  for (const agent of agents) {
    const skillsPath = agent.getNativeSkillsPath?.(projectRoot);
    if (skillsPath && !propagatedPaths.has(skillsPath)) {
      logVerboseInfo(
        `Copying skills to ${path.relative(projectRoot, skillsPath)} for ${agent.getName()}`,
        verbose,
        dryRun,
      );
      await propagateSkillsToPath(projectRoot, skillsPath, { dryRun });
      propagatedPaths.add(skillsPath);
    }
  }

  // Copy to .skillz directory if needed
  if (hasMcpAgent) {
    logVerboseInfo(
      `Copying skills to ${SKILLZ_DIR} for MCP agents`,
      verbose,
      dryRun,
    );
    await propagateSkillsForSkillz(projectRoot, { dryRun });
  }
}

/**
 * Propagates skills for MCP agents by copying .ruler/skills to .skillz.
 * Uses atomic replace to ensure safe overwriting of existing skills.
 * Returns dry-run steps if dryRun is true, otherwise returns empty array.
 */
export async function propagateSkillsForSkillz(
  projectRoot: string,
  options: { dryRun: boolean },
): Promise<string[]> {
  const skillsDir = path.join(projectRoot, RULER_SKILLS_PATH);
  const skillzPath = path.join(projectRoot, SKILLZ_DIR);

  // Check if source skills directory exists
  try {
    await fs.access(skillsDir);
  } catch {
    // No skills directory - return empty
    return [];
  }

  if (options.dryRun) {
    return [
      `Copy skills from ${RULER_SKILLS_PATH} to ${SKILLZ_DIR}`,
      `Configure Skillz MCP server with path to ${SKILLZ_DIR}`,
    ];
  }

  // Use atomic replace: copy to temp, then rename
  const tempDir = path.join(projectRoot, `${SKILLZ_DIR}.tmp-${Date.now()}`);

  try {
    // Copy to temp directory
    await copySkillsDirectory(skillsDir, tempDir);

    // Atomically replace the target
    // First, remove existing target if it exists
    try {
      await fs.rm(skillzPath, { recursive: true, force: true });
    } catch {
      // Target didn't exist, that's fine
    }

    // Rename temp to target
    await fs.rename(tempDir, skillzPath);
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
 * Builds MCP config for Skillz server.
 */
export function buildSkillzMcpConfig(
  projectRoot: string,
): Record<string, unknown> {
  void projectRoot;
  return {
    [SKILLZ_MCP_SERVER_NAME]: {
      command: 'uvx',
      args: ['skillz@latest', SKILLZ_DIR],
    },
  };
}
