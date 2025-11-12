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
import { parseFrontmatter } from './FrontmatterParser';

/**
 * Discovers skills in the project's skills directory (.ruler/skills or .claude/skills).
 * Returns discovered skills and any validation warnings.
 */
export async function discoverSkills(
  projectRoot: string,
  rulerDir?: string,
): Promise<{ skills: SkillInfo[]; warnings: string[] }> {
  // Determine skills directory based on rulerDir
  let skillsPath: string;
  if (rulerDir && path.basename(rulerDir) === '.claude') {
    // Use .claude/skills
    skillsPath = path.join(rulerDir, 'skills');
  } else {
    // Use .ruler/skills (default)
    skillsPath = path.join(projectRoot, RULER_SKILLS_PATH);
  }

  // Check if skills directory exists
  try {
    await fs.access(skillsPath);
  } catch {
    // Skills directory doesn't exist - this is fine, just return empty
    return { skills: [], warnings: [] };
  }

  // Walk the skills tree
  return await walkSkillsTree(skillsPath);
}

/**
 * Gets the paths that skills will generate, for gitignore purposes.
 * Returns empty array if skills directory doesn't exist.
 */
export async function getSkillsGitignorePaths(
  projectRoot: string,
): Promise<string[]> {
  const rulerSkillsDir = path.join(projectRoot, RULER_SKILLS_PATH);
  const claudeSkillsDir = path.join(projectRoot, '.claude', 'skills');

  // Check if skills directory exists in either location
  let isClaudeMode = false;
  let skillsExist = false;

  try {
    await fs.access(rulerSkillsDir);
    skillsExist = true;
    isClaudeMode = false;
  } catch {
    // Try .claude/skills
    try {
      await fs.access(claudeSkillsDir);
      skillsExist = true;
      isClaudeMode = true;
    } catch {
      return [];
    }
  }

  if (!skillsExist) {
    return [];
  }

  // Import here to avoid circular dependency
  const { CLAUDE_SKILLS_PATH, SKILLZ_DIR } = await import('../constants');

  const paths: string[] = [];

  // When using .claude/skills, check if it's generated from .claude/rules
  if (isClaudeMode) {
    // If .claude/rules exists, then .claude/skills is generated and should be gitignored
    const claudeRulesDir = path.join(projectRoot, '.claude', 'rules');
    try {
      await fs.access(claudeRulesDir);
      // .claude/rules exists, so .claude/skills is generated
      paths.push(path.join(projectRoot, CLAUDE_SKILLS_PATH));
    } catch {
      // .claude/rules doesn't exist, so .claude/skills is versioned (don't gitignore)
    }
  } else {
    // Using .ruler/skills - gitignore .claude/skills (generated copy)
    paths.push(path.join(projectRoot, CLAUDE_SKILLS_PATH));
  }

  // Always gitignore .skillz (for MCP agents)
  paths.push(path.join(projectRoot, SKILLZ_DIR));

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
// Currently unused but kept for potential future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
 * Recursively finds all .mdc files in a directory.
 */
async function findMdcFiles(dir: string): Promise<string[]> {
  const mdcFiles: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip skills directory to avoid processing generated files
        if (entry.name !== 'skills') {
          const subFiles = await findMdcFiles(fullPath);
          mdcFiles.push(...subFiles);
        }
      } else if (entry.isFile() && entry.name.endsWith('.mdc')) {
        mdcFiles.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist or can't be read, return empty
  }

  return mdcFiles;
}

/**
 * Generates skills from .mdc rule files with frontmatter.
 * Creates skill files in the skills directory with @filename references to the original .mdc files.
 */
export async function generateSkillsFromRules(
  projectRoot: string,
  rulerDir: string,
  verbose: boolean,
  dryRun: boolean,
): Promise<void> {
  // Determine skills directory based on rulerDir
  const skillsDir = path.join(rulerDir, 'skills');

  // Find all .mdc files in the ruler directory
  const mdcFiles = await findMdcFiles(rulerDir);

  if (mdcFiles.length === 0) {
    logVerboseInfo('No .mdc files found for skill generation', verbose, dryRun);
    return;
  }

  let generatedCount = 0;
  const skillsToRemove: string[] = [];

  for (const mdcFile of mdcFiles) {
    // Read file content
    const content = await fs.readFile(mdcFile, 'utf8');

    // Parse frontmatter
    const { frontmatter } = parseFrontmatter(content);

    // Skip files without frontmatter
    if (!frontmatter || Object.keys(frontmatter).length === 0) {
      continue;
    }

    // Derive skill name from filename (without extension)
    const fileName = path.basename(mdcFile, '.mdc');

    // If alwaysApply: true, mark any existing skill for removal
    if (frontmatter.alwaysApply === true) {
      skillsToRemove.push(fileName);
      continue;
    }

    // Build description with globs sentence
    let description =
      frontmatter.description || `Generated from ${fileName}.mdc`;
    if (frontmatter.globs && frontmatter.globs.length > 0) {
      const globsText = frontmatter.globs.join(', ');
      description += ` Applies to files matching: ${globsText}.`;
    }

    // Create skill directory
    const skillDir = path.join(skillsDir, fileName);
    const skillFile = path.join(skillDir, 'SKILL.md');

    // Generate @filename reference to the original .mdc file (relative to projectRoot)
    const relativeToProject = path
      .relative(projectRoot, mdcFile)
      .replace(/\\/g, '/');
    const fileReference = `@${relativeToProject}`;

    // Generate skill content with frontmatter
    const skillContent = `---
name: ${fileName}
description: ${description}
---

${fileReference}
`;

    if (dryRun) {
      logVerboseInfo(
        `DRY RUN: Would generate skill ${fileName} from ${path.relative(projectRoot, mdcFile)}`,
        verbose,
        dryRun,
      );
    } else {
      // Create skill directory and write file
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(skillFile, skillContent, 'utf8');
      logVerboseInfo(
        `Generated skill ${fileName} from ${path.relative(projectRoot, mdcFile)}`,
        verbose,
        dryRun,
      );

      // Check if .mdc file is in a folder with the same name
      // e.g., rules/docx/docx.mdc -> copy all files from rules/docx/ to skills/docx/
      const mdcDir = path.dirname(mdcFile);
      const mdcDirName = path.basename(mdcDir);

      if (mdcDirName === fileName) {
        // Parent folder matches the file name, copy additional files
        try {
          const entries = await fs.readdir(mdcDir, { withFileTypes: true });
          for (const entry of entries) {
            // Skip the .mdc file itself
            if (entry.name === `${fileName}.mdc`) {
              continue;
            }

            const sourcePath = path.join(mdcDir, entry.name);
            const targetPath = path.join(skillDir, entry.name);

            if (entry.isDirectory()) {
              // Recursively copy subdirectories
              const { copySkillsDirectory } = await import('./SkillsUtils');
              await copySkillsDirectory(sourcePath, targetPath);
              logVerboseInfo(
                `Copied directory ${entry.name} to skill ${fileName}`,
                verbose,
                dryRun,
              );
            } else {
              // Copy file
              await fs.copyFile(sourcePath, targetPath);
              logVerboseInfo(
                `Copied file ${entry.name} to skill ${fileName}`,
                verbose,
                dryRun,
              );
            }
          }
        } catch (error) {
          // If we can't read the directory, just skip copying additional files
          logVerboseInfo(
            `Could not copy additional files for skill ${fileName}: ${error}`,
            verbose,
            dryRun,
          );
        }
      }
    }

    generatedCount++;
  }

  if (generatedCount > 0) {
    logVerboseInfo(
      `Generated ${generatedCount} skill(s) from .mdc files`,
      verbose,
      dryRun,
    );
  }

  // Remove skills for .mdc files that now have alwaysApply: true
  if (skillsToRemove.length > 0) {
    for (const skillName of skillsToRemove) {
      const skillPath = path.join(skillsDir, skillName);
      try {
        const exists = await fs
          .access(skillPath)
          .then(() => true)
          .catch(() => false);
        if (exists) {
          if (dryRun) {
            logVerboseInfo(
              `DRY RUN: Would remove skill ${skillName} (alwaysApply changed to true)`,
              verbose,
              dryRun,
            );
          } else {
            await fs.rm(skillPath, { recursive: true, force: true });
            logVerboseInfo(
              `Removed skill ${skillName} (alwaysApply changed to true)`,
              verbose,
              dryRun,
            );
          }
        }
      } catch {
        // Ignore errors - skill might not exist
      }
    }
  }
}

/**
 * Cleans up skills directories (.claude/skills and .skillz) when skills are disabled.
 * This ensures that stale skills from previous runs don't persist when skills are turned off.
 */
async function cleanupSkillsDirectories(
  projectRoot: string,
  dryRun: boolean,
  verbose: boolean,
): Promise<void> {
  const claudeSkillsPath = path.join(projectRoot, CLAUDE_SKILLS_PATH);
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
 * Propagates skills for agents that need them.
 */
export async function propagateSkills(
  projectRoot: string,
  agents: IAgent[],
  skillsEnabled: boolean,
  verbose: boolean,
  dryRun: boolean,
  rulerDir?: string,
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

  // Determine skills directory based on rulerDir
  let skillsDir: string;
  if (rulerDir && path.basename(rulerDir) === '.claude') {
    skillsDir = path.join(rulerDir, 'skills');
  } else {
    skillsDir = path.join(projectRoot, RULER_SKILLS_PATH);
  }

  // Check if skills directory exists
  try {
    await fs.access(skillsDir);
  } catch {
    // No skills directory - this is fine
    const dirName =
      rulerDir && path.basename(rulerDir) === '.claude'
        ? '.claude/skills'
        : '.ruler/skills';
    logVerboseInfo(
      `No ${dirName} directory found, skipping skills propagation`,
      verbose,
      dryRun,
    );
    return;
  }

  // Discover skills
  const { skills, warnings } = await discoverSkills(projectRoot, rulerDir);

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
  // Cursor uses .cursor/rules (not skillz MCP), so exclude it from MCP agents
  const hasMcpAgent = agents.some(
    (a) =>
      a.supportsMcpStdio?.() &&
      !a.supportsNativeSkills?.() &&
      a.getIdentifier() !== 'cursor',
  );

  if (!hasNativeSkillsAgent && !hasMcpAgent) {
    logVerboseInfo('No agents require skills support', verbose, dryRun);
    return;
  }

  // Warn about experimental features
  if (hasMcpAgent) {
    // warnOnceExperimentalAndUv(verbose, dryRun);
  }

  // Copy to Claude skills directory if needed
  if (hasNativeSkillsAgent) {
    const isClaudeRoot = rulerDir && path.basename(rulerDir) === '.claude';
    if (!isClaudeRoot) {
      logVerboseInfo(
        `Copying skills to ${CLAUDE_SKILLS_PATH} for Claude Code`,
        verbose,
        dryRun,
      );
    }
    await propagateSkillsForClaude(projectRoot, { dryRun, rulerDir });
  }

  // Copy to .skillz directory if needed
  if (hasMcpAgent) {
    logVerboseInfo(
      `Copying skills to ${SKILLZ_DIR} for MCP agents (excluding Cursor)`,
      verbose,
      dryRun,
    );
    await propagateSkillsForSkillz(projectRoot, { dryRun, rulerDir });
  }
}

/**
 * Propagates skills for Claude Code by copying .ruler/skills to .claude/skills.
 * If rulerDir is .claude, skills are already in the right place, so no copy is needed.
 * Uses atomic replace to ensure safe overwriting of existing skills.
 * Returns dry-run steps if dryRun is true, otherwise returns empty array.
 */
export async function propagateSkillsForClaude(
  projectRoot: string,
  options: { dryRun: boolean; rulerDir?: string },
): Promise<string[]> {
  // If using .claude as the root folder, skills are already in .claude/skills
  const isClaudeRoot =
    options.rulerDir && path.basename(options.rulerDir) === '.claude';
  if (isClaudeRoot) {
    // No need to copy, skills are already in .claude/skills
    return [];
  }

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
 * Propagates skills for MCP agents by copying skills to .skillz.
 * Supports both .ruler/skills and .claude/skills as source.
 * Uses atomic replace to ensure safe overwriting of existing skills.
 * Returns dry-run steps if dryRun is true, otherwise returns empty array.
 */
export async function propagateSkillsForSkillz(
  projectRoot: string,
  options: { dryRun: boolean; rulerDir?: string },
): Promise<string[]> {
  // Determine source skills directory based on rulerDir
  const isClaudeRoot =
    options.rulerDir && path.basename(options.rulerDir) === '.claude';
  const skillsDir = isClaudeRoot
    ? path.join(projectRoot, '.claude', 'skills')
    : path.join(projectRoot, RULER_SKILLS_PATH);
  const skillzPath = path.join(projectRoot, SKILLZ_DIR);

  // Check if source skills directory exists
  try {
    await fs.access(skillsDir);
  } catch {
    // No skills directory - return empty
    return [];
  }

  if (options.dryRun) {
    const relativeSkillsPath = path.relative(projectRoot, skillsDir);
    return [
      `Copy skills from ${relativeSkillsPath} to ${SKILLZ_DIR}`,
      `Configure Skillz MCP server with absolute path to ${SKILLZ_DIR}`,
    ];
  }

  // Use atomic replace: copy to temp, then rename
  const tempDir = path.join(projectRoot, `${SKILLZ_DIR}.tmp-${Date.now()}`);

  try {
    // Copy and transform to temp directory
    // Transform @filename references to actual content for MCP agents
    const { copySkillsDirectoryWithTransform } = await import('./SkillsUtils');
    await copySkillsDirectoryWithTransform(skillsDir, tempDir, projectRoot);

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
  const skillzAbsPath = path.resolve(projectRoot, SKILLZ_DIR);
  return {
    [SKILLZ_MCP_SERVER_NAME]: {
      command: 'uvx',
      args: ['skillz@latest', skillzAbsPath],
    },
  };
}
