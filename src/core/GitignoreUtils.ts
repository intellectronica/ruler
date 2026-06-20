import { promises as fs } from 'fs';
import * as path from 'path';
import { writeGeneratedFile } from './FileSystemUtils';

const RULER_START_MARKER = '# START Ruler Generated Files';
const RULER_END_MARKER = '# END Ruler Generated Files';

interface RulerBlockRange {
  start: number;
  end: number;
}

/**
 * Updates an ignore file in the project root with paths in a managed Ruler block.
 * Creates the file if it doesn't exist, and creates or updates the Ruler-managed block.
 *
 * @param projectRoot The project root directory
 * @param paths Array of file paths to add to the ignore file (can be absolute or relative)
 * @param ignoreFile Relative path to the ignore file from project root (defaults to .gitignore)
 */
export async function updateGitignore(
  projectRoot: string,
  paths: string[],
  ignoreFile = '.gitignore',
): Promise<void> {
  const gitignorePath = await resolveIgnoreFilePath(projectRoot, ignoreFile);

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
  await writeGeneratedFile(gitignorePath, newContent);
}

/**
 * Resolves ignore files Ruler manages. Linked worktrees store `.git` as a
 * file containing a `gitdir:` pointer, so `.git/info/exclude` must be resolved
 * through that pointer.
 */
export async function resolveIgnoreFilePath(
  projectRoot: string,
  ignoreFile: string,
): Promise<string> {
  if (ignoreFile !== '.git/info/exclude') {
    return path.join(projectRoot, ignoreFile);
  }

  const dotGitPath = path.join(projectRoot, '.git');
  try {
    const dotGitStat = await fs.lstat(dotGitPath);
    if (dotGitStat.isFile()) {
      const dotGitContent = await fs.readFile(dotGitPath, 'utf8');
      const gitDirMatch = dotGitContent.match(/^gitdir:\s*(.+)\s*$/m);
      if (gitDirMatch) {
        const gitDir = gitDirMatch[1];
        const resolvedGitDir = path.isAbsolute(gitDir)
          ? gitDir
          : path.resolve(projectRoot, gitDir);
        return path.join(resolvedGitDir, 'info', 'exclude');
      }
    }
  } catch {
    // Fall back to the historical project-root path for non-git test fixtures
    // and unusual repositories where `.git` cannot be inspected.
  }

  return path.join(projectRoot, ignoreFile);
}

/**
 * Gets all paths from .gitignore content excluding those in the Ruler block.
 */
function getExistingPathsExcludingRulerBlock(content: string): string[] {
  const lines = content.split('\n');
  const rulerBlocks = findCompleteRulerBlocks(lines);
  const paths: string[] = [];

  for (const [index, line] of lines.entries()) {
    if (
      rulerBlocks.some((block) => index >= block.start && index <= block.end)
    ) {
      continue;
    }

    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      paths.push(trimmed);
    }
  }

  return paths;
}

function findCompleteRulerBlocks(lines: string[]): RulerBlockRange[] {
  const ranges: RulerBlockRange[] = [];

  for (let index = 0; index < lines.length; index++) {
    if (lines[index].trim() !== RULER_START_MARKER) {
      continue;
    }

    for (let endIndex = index + 1; endIndex < lines.length; endIndex++) {
      const trimmed = lines[endIndex].trim();
      if (trimmed === RULER_START_MARKER) {
        break;
      }
      if (trimmed === RULER_END_MARKER) {
        ranges.push({ start: index, end: endIndex });
        index = endIndex;
        break;
      }
    }
  }

  return ranges;
}

/**
 * Updates the .gitignore content by replacing or adding the Ruler block.
 */
function updateGitignoreContent(
  existingContent: string,
  rulerPaths: string[],
): string {
  const lines = existingContent.split('\n');
  const firstRulerBlock = findCompleteRulerBlocks(lines)[0];
  const newLines: string[] = [];

  for (let index = 0; index < lines.length; index++) {
    if (firstRulerBlock && index === firstRulerBlock.start) {
      newLines.push(lines[index]);
      rulerPaths.forEach((p) => newLines.push(p));
      newLines.push(lines[firstRulerBlock.end]);
      index = firstRulerBlock.end;
      continue;
    }

    newLines.push(lines[index]);
  }

  // If no Ruler block exists, add one at the end
  if (!firstRulerBlock) {
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
