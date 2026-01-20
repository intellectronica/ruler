import * as path from 'path';
import * as fs from 'fs/promises';
import * as readline from 'readline';
import { SkillInfo } from '../types';
import {
  CLAUDE_SKILLS_PATH,
  SKILL_MD_FILENAME,
  SKILLZ_DIR,
  SKILLZ_MCP_SERVER_NAME,
  logWarn,
  logVerboseInfo,
} from '../constants';
import { walkSkillsTree, copySkillsDirectory } from './SkillsUtils';
import type { IAgent } from '../agents/IAgent';
import { parseFrontmatter } from './FrontmatterParser';

/**
 * Discovers skills in the project's skills directory (.claude/skills).
 * Returns discovered skills and any validation warnings.
 */
export async function discoverSkills(
  projectRoot: string,
  skillerDir?: string,
): Promise<{ skills: SkillInfo[]; warnings: string[] }> {
  // Use .claude/skills
  const skillsPath = skillerDir
    ? path.join(skillerDir, 'skills')
    : path.join(projectRoot, CLAUDE_SKILLS_PATH);

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
 * Options for getSkillsGitignorePaths.
 */
export interface SkillsGitignoreOptions {
  /** If true, .claude/skills is considered generated and should be gitignored. */
  generateFromRules?: boolean;
}

/**
 * Gets the paths that skills will generate, for gitignore purposes.
 * When generateFromRules is true, always includes .claude/skills even if it doesn't exist yet.
 */
export async function getSkillsGitignorePaths(
  projectRoot: string,
  options: SkillsGitignoreOptions = {},
): Promise<string[]> {
  const paths: string[] = [];

  // Gitignore .claude/skills if:
  // 1. generate_from_rules is explicitly true in config (always gitignore, even if dir doesn't exist)
  // 2. OR .claude/rules directory exists (skills are generated from rules)
  // 3. OR .claude/skills exists AND .claude/rules exists (legacy check)
  if (options.generateFromRules) {
    // Config says skills are generated from rules - always gitignore
    paths.push(path.join(projectRoot, CLAUDE_SKILLS_PATH));
  } else {
    // Check if .claude/skills exists
    const claudeSkillsDir = path.join(projectRoot, CLAUDE_SKILLS_PATH);
    let skillsExist = false;
    try {
      await fs.access(claudeSkillsDir);
      skillsExist = true;
    } catch {
      // Skills directory doesn't exist
    }

    if (skillsExist) {
      // Check if .claude/rules exists (fallback for when config not passed)
      const claudeRulesDir = path.join(projectRoot, '.claude', 'rules');
      try {
        await fs.access(claudeRulesDir);
        // .claude/rules exists, so .claude/skills is generated
        paths.push(path.join(projectRoot, CLAUDE_SKILLS_PATH));
      } catch {
        // .claude/rules doesn't exist, so .claude/skills is versioned (don't gitignore)
      }
    }
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
 * Prompts the user via readline to confirm deletion of orphaned skills.
 * Returns true if user confirms, false otherwise.
 */
async function promptForPrune(orphanedSkills: string[]): Promise<boolean> {
  // If not running in a TTY (e.g., CI/CD), skip prompting
  if (!process.stdin.isTTY) {
    logWarn(
      `Found ${orphanedSkills.length} orphaned skill(s) but not in interactive mode. Set prune = true/false in skiller.toml to handle automatically.`,
      false,
    );
    return false;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log(
      `\nFound ${orphanedSkills.length} orphaned skill(s) not generated from rules:`,
    );
    orphanedSkills.forEach((skill) => console.log(`  - ${skill}`));
    console.log('');

    rl.question('Delete these orphaned skills? [y/N]: ', (answer) => {
      rl.close();
      const confirmed =
        answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
      if (confirmed) {
        console.log('');
      } else {
        console.log(
          "\nTip: Add 'prune = true' or 'prune = false' to [skills] in skiller.toml to avoid this prompt.\n",
        );
      }
      resolve(confirmed);
    });
  });
}

/**
 * Prunes orphaned skills (skills that exist in .claude/skills but are not generated from any .mdc file).
 * @param skillsDir Path to the skills directory
 * @param generatedSkillNames Set of skill names that were generated from .mdc files
 * @param prune Prune setting: true=auto-delete, false=keep, undefined=prompt
 * @param verbose Whether to log verbose output
 * @param dryRun Whether to perform a dry run
 */
async function pruneOrphanedSkills(
  skillsDir: string,
  generatedSkillNames: Set<string>,
  prune: boolean | undefined,
  verbose: boolean,
  dryRun: boolean,
): Promise<void> {
  // Check if skills directory exists
  try {
    await fs.access(skillsDir);
  } catch {
    // No skills directory, nothing to prune
    return;
  }

  // Get all existing skill directories
  const entries = await fs.readdir(skillsDir, { withFileTypes: true });
  const existingSkillDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  // Find orphaned skills (exist but not in generatedSkillNames)
  const orphanedSkills = existingSkillDirs.filter(
    (name) => !generatedSkillNames.has(name),
  );

  if (orphanedSkills.length === 0) {
    logVerboseInfo('No orphaned skills found', verbose, dryRun);
    return;
  }

  // Determine whether to delete based on prune setting
  let shouldDelete = false;

  if (prune === true) {
    // Auto-delete
    shouldDelete = true;
    logVerboseInfo(
      `Auto-pruning ${orphanedSkills.length} orphaned skill(s) (prune = true)`,
      verbose,
      dryRun,
    );
  } else if (prune === false) {
    // Keep orphans
    logVerboseInfo(
      `Keeping ${orphanedSkills.length} orphaned skill(s) (prune = false)`,
      verbose,
      dryRun,
    );
    return;
  } else {
    // prune is undefined - prompt user
    shouldDelete = await promptForPrune(orphanedSkills);
    if (!shouldDelete) {
      return;
    }
  }

  // Delete orphaned skills
  for (const skillName of orphanedSkills) {
    const skillPath = path.join(skillsDir, skillName);
    if (dryRun) {
      logVerboseInfo(
        `DRY RUN: Would remove orphaned skill ${skillName}`,
        verbose,
        dryRun,
      );
    } else {
      await fs.rm(skillPath, { recursive: true, force: true });
      logVerboseInfo(`Removed orphaned skill ${skillName}`, verbose, dryRun);
    }
  }
}

/**
 * Generates skills from .mdc rule files with frontmatter.
 * Creates skill files in the skills directory with @filename references to the original .mdc files.
 * @param projectRoot Root directory of the project
 * @param skillerDir Path to the skiller directory (.claude)
 * @param verbose Whether to log verbose output
 * @param dryRun Whether to perform a dry run
 * @param prune Prune setting: true=auto-delete orphans, false=keep orphans, undefined=prompt
 */
export async function generateSkillsFromRules(
  projectRoot: string,
  skillerDir: string,
  verbose: boolean,
  dryRun: boolean,
  prune?: boolean,
): Promise<void> {
  // Determine skills directory based on skillerDir
  const skillsDir = path.join(skillerDir, 'skills');

  // Find all .mdc files in the skiller directory
  const mdcFiles = await findMdcFiles(skillerDir);

  if (mdcFiles.length === 0) {
    logVerboseInfo('No .mdc files found for skill generation', verbose, dryRun);
    return;
  }

  let generatedCount = 0;
  const skillsToRemove: string[] = [];
  const generatedSkillNames = new Set<string>();

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
    generatedSkillNames.add(fileName);
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

  // Prune orphaned skills if prune setting is configured
  await pruneOrphanedSkills(
    skillsDir,
    generatedSkillNames,
    prune,
    verbose,
    dryRun,
  );
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
  skillerDir?: string,
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

  // Determine skills directory - always use .claude/skills
  const skillsDir = skillerDir
    ? path.join(skillerDir, 'skills')
    : path.join(projectRoot, CLAUDE_SKILLS_PATH);

  // Check if skills directory exists
  try {
    await fs.access(skillsDir);
  } catch {
    // No skills directory - this is fine
    logVerboseInfo(
      `No .claude/skills directory found, skipping skills propagation`,
      verbose,
      dryRun,
    );
    return;
  }

  // Discover skills
  const { skills, warnings } = await discoverSkills(projectRoot, skillerDir);

  if (warnings.length > 0) {
    warnings.forEach((warning) => logWarn(warning, dryRun));
  }

  if (skills.length === 0) {
    logVerboseInfo('No valid skills found in .claude/skills', verbose, dryRun);
    return;
  }

  logVerboseInfo(`Discovered ${skills.length} skill(s)`, verbose, dryRun);

  // Check if any agents need skills
  const hasNativeSkillsAgent = agents.some((a) => a.supportsNativeSkills?.());
  // Only add skillz for agents that support MCP stdio but not native skills
  // Claude Code and Cursor are excluded because they have native skills support
  const hasMcpAgent = agents.some(
    (a) => a.supportsMcpStdio?.() && !a.supportsNativeSkills?.(),
  );

  if (!hasNativeSkillsAgent && !hasMcpAgent) {
    logVerboseInfo('No agents require skills support', verbose, dryRun);
    return;
  }

  // Warn about experimental features
  if (hasMcpAgent) {
    // warnOnceExperimentalAndUv(verbose, dryRun);
  }

  // Copy to .skillz directory if needed (for MCP agents without native skills)
  if (hasMcpAgent) {
    logVerboseInfo(
      `Copying skills to ${SKILLZ_DIR} for MCP agents without native skills support`,
      verbose,
      dryRun,
    );
    await propagateSkillsForSkillz(projectRoot, { dryRun, skillerDir });
  }
}

/**
 * Propagates skills for MCP agents by copying skills to .skillz.
 * Uses .claude/skills as the source.
 * Uses atomic replace to ensure safe overwriting of existing skills.
 * Returns dry-run steps if dryRun is true, otherwise returns empty array.
 */
export async function propagateSkillsForSkillz(
  projectRoot: string,
  options: { dryRun: boolean; skillerDir?: string },
): Promise<string[]> {
  // Use .claude/skills as the source
  const skillsDir = options.skillerDir
    ? path.join(options.skillerDir, 'skills')
    : path.join(projectRoot, CLAUDE_SKILLS_PATH);
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

/**
 * Recursively finds all folders containing SKILL.md in a directory.
 */
async function findSkillFoldersInRules(dir: string): Promise<string[]> {
  const skillFolders: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const entryPath = path.join(dir, entry.name);

      // Check if this folder contains SKILL.md
      try {
        await fs.access(path.join(entryPath, SKILL_MD_FILENAME));
        skillFolders.push(entryPath);
      } catch {
        // No SKILL.md, check subdirectories recursively
        const subFolders = await findSkillFoldersInRules(entryPath);
        skillFolders.push(...subFolders);
      }
    }
  } catch {
    // Directory can't be read
  }

  return skillFolders;
}

/**
 * Copies skill folders (folders containing SKILL.md) from .claude/rules to .claude/skills.
 * This allows users to organize skills in the rules directory and have them automatically
 * propagated to the skills directory during apply.
 */
export async function copySkillFoldersFromRules(
  skillerDir: string,
  verbose: boolean,
  dryRun: boolean,
): Promise<void> {
  const rulesDir = path.join(skillerDir, 'rules');
  const skillsDir = path.join(skillerDir, 'skills');

  // Check if rules directory exists
  try {
    await fs.access(rulesDir);
  } catch {
    logVerboseInfo('No .claude/rules directory found', verbose, dryRun);
    return;
  }

  // Find all folders containing SKILL.md recursively
  const skillFolders = await findSkillFoldersInRules(rulesDir);

  if (skillFolders.length === 0) {
    logVerboseInfo(
      'No skill folders (with SKILL.md) found in .claude/rules',
      verbose,
      dryRun,
    );
    return;
  }

  // Copy each skill folder to .claude/skills
  for (const skillFolder of skillFolders) {
    const folderName = path.basename(skillFolder);
    const targetDir = path.join(skillsDir, folderName);

    if (dryRun) {
      logVerboseInfo(
        `DRY RUN: Would copy skill folder ${folderName} from rules to skills`,
        verbose,
        dryRun,
      );
    } else {
      await fs.mkdir(targetDir, { recursive: true });
      await copySkillsDirectory(skillFolder, targetDir);
      logVerboseInfo(
        `Copied skill folder ${folderName} from rules to skills`,
        verbose,
        dryRun,
      );
    }
  }

  logVerboseInfo(
    `Copied ${skillFolders.length} skill folder(s) from rules to skills`,
    verbose,
    dryRun,
  );
}
