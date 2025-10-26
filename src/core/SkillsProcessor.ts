import * as path from 'path';
import * as fs from 'fs/promises';
import { SkillInfo } from '../types';
import {
  RULER_SKILLS_PATH,
  CLAUDE_SKILLS_PATH,
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
  const { CLAUDE_SKILLS_PATH, SKILLZ_DIR } = await import('../constants');

  return [
    path.join(projectRoot, CLAUDE_SKILLS_PATH),
    path.join(projectRoot, SKILLZ_DIR),
  ];
}

// Track if we've already warned about experimental features
let hasWarnedExperimental = false;

/**
 * Warns once about experimental skills features and uv requirement.
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
    logVerboseInfo('Skills support disabled, skipping propagation', verbose, dryRun);
    return;
  }

  const skillsDir = path.join(projectRoot, RULER_SKILLS_PATH);

  // Check if skills directory exists
  try {
    await fs.access(skillsDir);
  } catch {
    // No skills directory - this is fine
    logVerboseInfo('No .ruler/skills directory found, skipping skills propagation', verbose, dryRun);
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
  const hasNativeSkillsAgent = agents.some((a) =>
    a.supportsNativeSkills?.(),
  );
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

  // Copy to Claude skills directory if needed
  if (hasNativeSkillsAgent) {
    const claudeSkillsPath = path.join(projectRoot, CLAUDE_SKILLS_PATH);
    logVerboseInfo(
      `Copying skills to ${CLAUDE_SKILLS_PATH} for Claude Code`,
      verbose,
      dryRun,
    );
    if (!dryRun) {
      await copySkillsDirectory(skillsDir, claudeSkillsPath);
    }
  }

  // Copy to .skillz directory if needed
  if (hasMcpAgent) {
    const skillzPath = path.join(projectRoot, SKILLZ_DIR);
    logVerboseInfo(
      `Copying skills to ${SKILLZ_DIR} for MCP agents`,
      verbose,
      dryRun,
    );
    if (!dryRun) {
      await copySkillsDirectory(skillsDir, skillzPath);
    }
  }
}

/**
 * Builds MCP config for Skillz server.
 */
export function buildSkillzMcpConfig(
  projectRoot: string,
): Record<string, unknown> {
  const skillzAbsPath = path.resolve(projectRoot, SKILLZ_DIR);
  return {
    [SKILLZ_MCP_SERVER_NAME]: {
      command: 'uvx',
      args: ['skillz@latest', skillzAbsPath],
    },
  };
}
