import { promises as fs } from 'fs';
import * as path from 'path';

const RULER_START_MARKER = '# START Ruler Generated Files';
const RULER_END_MARKER = '# END Ruler Generated Files';

/**
 * Updates the .gitignore file in the project root with paths in a managed Ruler block.
 * Creates the file if it doesn't exist, and creates or updates the Ruler-managed block.
 *
 * @param projectRoot The project root directory (where .gitignore should be located)
 * @param paths Array of file paths to add to .gitignore (can be absolute or relative)
 */
export async function updateGitignore(
  projectRoot: string,
  paths: string[],
): Promise<void> {
  const gitignorePath = path.join(projectRoot, '.gitignore');

  // Read existing .gitignore or start with empty content
  let existingContent = '';
  try {
    existingContent = await fs.readFile(gitignorePath, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
  }

  // Convert paths to repo-relative POSIX format with leading /
  const relativePaths = paths
    .map((p) => {
      let relative: string;
      if (path.isAbsolute(p)) {
        relative = path.relative(projectRoot, p);
      } else {
        // Handle relative paths that might include the project root prefix
        const normalizedProjectRoot = path.normalize(projectRoot);
        const normalizedPath = path.normalize(p);

        // Get the basename of the project root to match against path prefixes
        const projectBasename = path.basename(normalizedProjectRoot);

        // If the path starts with the project basename, remove it
        if (normalizedPath.startsWith(projectBasename + path.sep)) {
          relative = normalizedPath.substring(projectBasename.length + 1);
        } else {
          relative = normalizedPath;
        }
      }
      return relative.replace(/\\/g, '/'); // Convert to POSIX format
    })
    .filter((p) => {
      // Never include any path that resides inside a .ruler directory (inputs, not outputs)
      return !p.includes('/.ruler/') && !p.startsWith('.ruler/');
    })
    .map((p) => {
      // Always write full repository-relative paths (prefix with leading /)
      return p.startsWith('/') ? p : `/${p}`;
    });

  // Get all existing paths from .gitignore (excluding Ruler block)
  const existingPaths = getExistingPathsExcludingRulerBlock(existingContent);

  // Filter out paths that already exist outside the Ruler block
  const newPaths = relativePaths.filter((p) => !existingPaths.includes(p));

  // The Ruler block should contain only the new paths (replacement behavior)
  const allRulerPaths = [...new Set(newPaths)].sort();

  // Create new content
  const newContent = updateGitignoreContent(existingContent, allRulerPaths);

  // Write the updated content
  await fs.writeFile(gitignorePath, newContent);
}

/**
 * Gets all paths from .gitignore content excluding those in the Ruler block.
 */
function getExistingPathsExcludingRulerBlock(content: string): string[] {
  const lines = content.split('\n');
  const paths: string[] = [];
  let inRulerBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === RULER_START_MARKER) {
      inRulerBlock = true;
      continue;
    }
    if (trimmed === RULER_END_MARKER) {
      inRulerBlock = false;
      continue;
    }
    if (!inRulerBlock && trimmed && !trimmed.startsWith('#')) {
      paths.push(trimmed);
    }
  }

  return paths;
}

/**
 * Updates the .gitignore content by replacing or adding the Ruler block.
 */
function updateGitignoreContent(
  existingContent: string,
  rulerPaths: string[],
): string {
  const lines = existingContent.split('\n');
  const newLines: string[] = [];
  let inFirstRulerBlock = false;
  let hasRulerBlock = false;
  let processedFirstBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === RULER_START_MARKER && !processedFirstBlock) {
      inFirstRulerBlock = true;
      hasRulerBlock = true;
      newLines.push(line);
      // Add the new Ruler paths
      rulerPaths.forEach((p) => newLines.push(p));
      continue;
    }
    if (trimmed === RULER_END_MARKER && inFirstRulerBlock) {
      inFirstRulerBlock = false;
      processedFirstBlock = true;
      newLines.push(line);
      continue;
    }
    if (!inFirstRulerBlock) {
      newLines.push(line);
    }
    // Skip lines that are in the first Ruler block (they get replaced)
  }

  // If no Ruler block exists, add one at the end
  if (!hasRulerBlock) {
    // Add blank line if content exists and doesn't end with blank line
    if (existingContent.trim() && !existingContent.endsWith('\n\n')) {
      newLines.push('');
    }
    newLines.push(RULER_START_MARKER);
    rulerPaths.forEach((p) => newLines.push(p));
    newLines.push(RULER_END_MARKER);
  }

  // Ensure file ends with a newline
  let result = newLines.join('\n');
  if (!result.endsWith('\n')) {
    result += '\n';
  }

  return result;
}
