import * as path from 'path';
import * as fs from 'fs/promises';
import { SkillInfo } from '../types';
import { RULER_SKILLS_PATH } from '../constants';
import { walkSkillsTree } from './SkillsUtils';

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
