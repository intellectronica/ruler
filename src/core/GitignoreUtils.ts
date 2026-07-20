import { promises as fs } from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeGeneratedFile } from './FileSystemUtils';
import { isPathInsideOrEqual } from './path-utils';

const RULER_START_MARKER = '# START Ruler Generated Files';
const RULER_END_MARKER = '# END Ruler Generated Files';
const execFileAsync = promisify(execFile);

export interface RulerBlockRange {
  start: number;
  end: number;
}

export interface RemoveRulerBlocksResult {
  content: string;
  removed: boolean;
}

export interface ResolvedIgnoreFile {
  path: string;
  containmentRoot: string;
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
  const ignoreTarget = await resolveIgnoreFileTarget(projectRoot, ignoreFile);
  const gitignorePath = ignoreTarget.path;

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
    .filter((p) => !isRulerSourcePath(p))
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
  await writeGeneratedFile(
    gitignorePath,
    newContent,
    ignoreTarget.containmentRoot,
  );
}

function isRulerSourcePath(relativePath: string): boolean {
  const segments = relativePath.split('/');

  for (let index = 0; index < segments.length; index++) {
    if (segments[index] !== '.ruler') {
      continue;
    }

    return segments[index + 1] !== '.generated';
  }

  return false;
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
  return (await resolveIgnoreFileTarget(projectRoot, ignoreFile)).path;
}

export async function resolveIgnoreFileTarget(
  projectRoot: string,
  ignoreFile: string,
): Promise<ResolvedIgnoreFile> {
  if (ignoreFile !== '.git/info/exclude') {
    return {
      path: path.join(projectRoot, ignoreFile),
      containmentRoot: projectRoot,
    };
  }

  const dotGitPath = path.join(projectRoot, '.git');
  let dotGitStat;
  try {
    dotGitStat = await fs.lstat(dotGitPath);
  } catch {
    // Fall back to the historical project-root path for non-git test fixtures
    // and unusual repositories where `.git` cannot be inspected.
    return {
      path: path.join(projectRoot, ignoreFile),
      containmentRoot: projectRoot,
    };
  }

  if (dotGitStat.isFile()) {
    const dotGitContent = await fs.readFile(dotGitPath, 'utf8');
    const gitDirMatch = dotGitContent.match(/^gitdir:\s*(.+)\s*$/m);
    if (gitDirMatch) {
      const gitDir = gitDirMatch[1];
      const resolvedGitDir = path.isAbsolute(gitDir)
        ? gitDir
        : path.resolve(projectRoot, gitDir);
      await assertTrustedGitDir(projectRoot, resolvedGitDir);
      return {
        path: path.join(resolvedGitDir, 'info', 'exclude'),
        containmentRoot: resolvedGitDir,
      };
    }
  } else if (dotGitStat.isDirectory()) {
    return {
      path: path.join(dotGitPath, 'info', 'exclude'),
      containmentRoot: projectRoot,
    };
  }

  return {
    path: path.join(projectRoot, ignoreFile),
    containmentRoot: projectRoot,
  };
}

async function assertTrustedGitDir(
  projectRoot: string,
  resolvedGitDir: string,
): Promise<void> {
  const realProjectRoot = await fs.realpath(projectRoot);
  const realGitDir = await fs.realpath(resolvedGitDir);
  if (isPathInsideOrEqual(realProjectRoot, realGitDir)) {
    return;
  }

  try {
    const { stdout } = await execFileAsync('git', [
      '-C',
      projectRoot,
      'rev-parse',
      '--absolute-git-dir',
    ]);
    const realVerifiedGitDir = await fs.realpath(stdout.trim());
    if (realVerifiedGitDir === realGitDir) {
      return;
    }
  } catch {
    // Fall through to the fail-closed error below.
  }

  throw new Error(
    `Refusing to use untrusted gitdir for .git/info/exclude: ${resolvedGitDir}`,
  );
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

export function findCompleteRulerBlocks(lines: string[]): RulerBlockRange[] {
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

export function removeCompleteRulerBlocks(
  content: string,
): RemoveRulerBlocksResult {
  const lines = content.split('\n');
  const rulerBlocks = findCompleteRulerBlocks(lines);

  if (rulerBlocks.length === 0) {
    return { content, removed: false };
  }

  const retainedLines: string[] = [];

  for (let index = 0; index < lines.length; index++) {
    const block = rulerBlocks.find((range) => range.start === index);
    if (block) {
      index = block.end;
      continue;
    }

    retainedLines.push(lines[index]);
  }

  return {
    content: retainedLines.join('\n').replace(/\n{3,}/g, '\n\n'),
    removed: true,
  };
}

/**
 * Updates the .gitignore content by replacing or adding the Ruler block.
 */
function updateGitignoreContent(
  existingContent: string,
  rulerPaths: string[],
): string {
  const lines = existingContent.split('\n');
  const rulerBlocks = findCompleteRulerBlocks(lines);
  const newLines: string[] = [];
  let replacedFirstBlock = false;

  for (let index = 0; index < lines.length; index++) {
    const block = rulerBlocks.find((range) => range.start === index);
    if (block && !replacedFirstBlock) {
      newLines.push(lines[block.start]);
      rulerPaths.forEach((p) => newLines.push(p));
      newLines.push(lines[block.end]);
      replacedFirstBlock = true;
      index = block.end;
      continue;
    }

    if (block) {
      index = block.end;
      continue;
    }

    newLines.push(lines[index]);
  }

  // If no Ruler block exists, add one at the end
  if (rulerBlocks.length === 0) {
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
