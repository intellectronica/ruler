import { promises as fs } from 'fs';
import * as path from 'path';

const SKILLER_START_MARKER = '# START Skiller Generated Files';
const SKILLER_END_MARKER = '# END Skiller Generated Files';

/**
 * Updates the .gitignore file in the project root with paths in a managed Skiller block.
 * Creates the file if it doesn't exist, and creates or updates the Skiller-managed block.
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
      // Never include any path that resides inside a .claude directory (inputs, not outputs)
      return !p.includes('/.claude/') && !p.startsWith('.claude/');
    })
    .map((p) => {
      // Always write full repository-relative paths (prefix with leading /)
      return p.startsWith('/') ? p : `/${p}`;
    });

  // Get all existing paths from .gitignore (excluding Skiller block)
  const existingPaths = getExistingPathsExcludingSkillerBlock(existingContent);

  // Filter out paths that already exist outside the Skiller block
  const newPaths = relativePaths.filter((p) => !existingPaths.includes(p));

  // The Skiller block should contain only the new paths (replacement behavior)
  const allSkillerPaths = [...new Set(newPaths)].sort();

  // Create new content
  const newContent = updateGitignoreContent(existingContent, allSkillerPaths);

  // Write the updated content
  await fs.writeFile(gitignorePath, newContent);
}

/**
 * Gets all paths from .gitignore content excluding those in the Skiller block.
 */
function getExistingPathsExcludingSkillerBlock(content: string): string[] {
  const lines = content.split('\n');
  const paths: string[] = [];
  let inSkillerBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === SKILLER_START_MARKER) {
      inSkillerBlock = true;
      continue;
    }
    if (trimmed === SKILLER_END_MARKER) {
      inSkillerBlock = false;
      continue;
    }
    if (!inSkillerBlock && trimmed && !trimmed.startsWith('#')) {
      paths.push(trimmed);
    }
  }

  return paths;
}

/**
 * Updates the .gitignore content by replacing or adding the Skiller block.
 */
function updateGitignoreContent(
  existingContent: string,
  skillerPaths: string[],
): string {
  const lines = existingContent.split('\n');
  const newLines: string[] = [];
  let inFirstSkillerBlock = false;
  let hasSkillerBlock = false;
  let processedFirstBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === SKILLER_START_MARKER && !processedFirstBlock) {
      inFirstSkillerBlock = true;
      hasSkillerBlock = true;
      newLines.push(line);
      // Add the new Skiller paths
      skillerPaths.forEach((p) => newLines.push(p));
      continue;
    }
    if (trimmed === SKILLER_END_MARKER && inFirstSkillerBlock) {
      inFirstSkillerBlock = false;
      processedFirstBlock = true;
      newLines.push(line);
      continue;
    }
    if (!inFirstSkillerBlock) {
      newLines.push(line);
    }
    // Skip lines that are in the first Skiller block (they get replaced)
  }

  // If no Skiller block exists, add one at the end
  if (!hasSkillerBlock) {
    // Add blank line if content exists and doesn't end with blank line
    if (existingContent.trim() && !existingContent.endsWith('\n\n')) {
      newLines.push('');
    }
    newLines.push(SKILLER_START_MARKER);
    skillerPaths.forEach((p) => newLines.push(p));
    newLines.push(SKILLER_END_MARKER);
  }

  // Ensure file ends with a newline
  let result = newLines.join('\n');
  if (!result.endsWith('\n')) {
    result += '\n';
  }

  return result;
}
