import * as path from 'path';
import * as fs from 'fs/promises';
import { SkillInfo } from '../types';
import { SKILL_MD_FILENAME } from '../constants';

/**
 * Checks if a directory contains a SKILL.md file.
 */
export async function hasSkillMd(dirPath: string): Promise<boolean> {
  try {
    const skillMdPath = path.join(dirPath, SKILL_MD_FILENAME);
    await fs.access(skillMdPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a directory is a grouping directory (contains subdirectories with SKILL.md).
 */
export async function isGroupingDir(dirPath: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const subdirs = entries.filter((e) => e.isDirectory());

    for (const subdir of subdirs) {
      const subdirPath = path.join(dirPath, subdir.name);
      if (await hasSkillMd(subdirPath)) {
        return true;
      }
      // Check recursively for nested grouping
      if (await isGroupingDir(subdirPath)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Walks the skills tree and discovers all skills.
 * Returns skills and any validation warnings.
 */
export async function walkSkillsTree(
  root: string,
): Promise<{ skills: SkillInfo[]; warnings: string[] }> {
  const skills: SkillInfo[] = [];
  const warnings: string[] = [];

  async function walk(currentPath: string, relativePath: string) {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const entryPath = path.join(currentPath, entry.name);
        const entryRelativePath = relativePath
          ? path.join(relativePath, entry.name)
          : entry.name;

        const hasSkill = await hasSkillMd(entryPath);
        const isGrouping = !hasSkill && (await isGroupingDir(entryPath));

        if (hasSkill) {
          // This is a valid skill directory
          skills.push({
            name: entry.name,
            path: entryPath,
            hasSkillMd: true,
            valid: true,
          });
        } else if (isGrouping) {
          // This is a grouping directory, recurse into it
          await walk(entryPath, entryRelativePath);
        } else {
          // This is neither a skill nor a grouping directory - warn about it
          warnings.push(
            `Directory '${entryRelativePath}' in .ruler/skills has no SKILL.md and contains no sub-skills. It may be malformed or stray.`,
          );
        }
      }
    } catch (err) {
      // If we can't read the directory, just return what we have
      warnings.push(
        `Failed to read directory ${relativePath || 'root'}: ${(err as Error).message}`,
      );
    }
  }

  await walk(root, '');
  return { skills, warnings };
}

/**
 * Formats validation warnings for display.
 */
export function formatValidationWarnings(warnings: string[]): string {
  if (warnings.length === 0) {
    return '';
  }
  return warnings.map((w) => `  - ${w}`).join('\n');
}

/**
 * Recursively copies a directory and all its contents.
 */
async function copyRecursive(src: string, dest: string): Promise<void> {
  const stat = await fs.stat(src);

  if (stat.isDirectory()) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      await copyRecursive(srcPath, destPath);
    }
  } else {
    await fs.copyFile(src, dest);
  }
}

/**
 * Copies the skills directory to the destination, preserving structure.
 * Creates the destination directory if it doesn't exist.
 */
export async function copySkillsDirectory(
  srcDir: string,
  destDir: string,
): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });
  await copyRecursive(srcDir, destDir);
}
