import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Gets the XDG config directory path, falling back to ~/.config if XDG_CONFIG_HOME is not set.
 */
function getXdgConfigDir(): string {
  return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
}

/**
 * Searches upwards from startPath to find a directory named .ruler.
 * If not found locally and checkGlobal is true, checks for global config at XDG_CONFIG_HOME/ruler.
 * Returns the path to the .ruler directory, or null if not found.
 */
export async function findRulerDir(
  startPath: string,
  checkGlobal: boolean = true,
): Promise<string | null> {
  // First, search upwards from startPath for local .ruler directory
  let current = startPath;
  while (current) {
    const candidate = path.join(current, '.ruler');
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) {
        return candidate;
      }
    } catch {
      // ignore errors when checking for .ruler directory
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  // If no local .ruler found and checkGlobal is true, check global config directory
  if (checkGlobal) {
    const globalConfigDir = path.join(getXdgConfigDir(), 'ruler');
    try {
      const stat = await fs.stat(globalConfigDir);
      if (stat.isDirectory()) {
        return globalConfigDir;
      }
    } catch (err) {
      console.error(
        `[ruler] Error checking global config directory ${globalConfigDir}:`,
        err,
      );
    }
  }

  return null;
}

/**
 * Simple glob pattern matcher supporting basic patterns:
 * - `*` matches any characters except `/`
 * - `**` matches any characters including `/` (zero or more path segments)
 * - Exact string matches
 */
export function matchesPattern(filePath: string, pattern: string): boolean {
  // Convert glob pattern to regex
  // Escape special regex characters except * and /
  let regexPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    // Replace **/ with a special placeholder (matches zero or more path segments)
    .replace(/\*\*\//g, '__DOUBLESTAR_SLASH__')
    // Replace /** with another placeholder
    .replace(/\/\*\*/g, '__SLASH_DOUBLESTAR__')
    // Replace remaining ** with yet another placeholder
    .replace(/\*\*/g, '__DOUBLESTAR__')
    // Replace single * with regex (matches anything except /)
    .replace(/\*/g, '[^/]*')
    // Replace **/ with regex that matches zero or more path segments
    .replace(/__DOUBLESTAR_SLASH__/g, '(?:.*?/)?')
    // Replace /** with regex
    .replace(/__SLASH_DOUBLESTAR__/g, '(?:/.*)?')
    // Replace standalone ** with regex
    .replace(/__DOUBLESTAR__/g, '.*');

  // Anchor the pattern to match the full path
  regexPattern = '^' + regexPattern + '$';

  const regex = new RegExp(regexPattern);
  return regex.test(filePath);
}

/**
 * Recursively reads all Markdown (.md) files in rulerDir, returning their paths and contents.
 * Files are sorted alphabetically by path.
 *
 * @param rulerDir The directory to scan for markdown files
 * @param options Optional filtering configuration
 * @param options.include Glob patterns to include (if specified, only matching files are included)
 * @param options.exclude Glob patterns to exclude (takes precedence over include)
 */
export async function readMarkdownFiles(
  rulerDir: string,
  options?: {
    include?: string[];
    exclude?: string[];
  },
): Promise<{ path: string; content: string }[]> {
  const mdFiles: { path: string; content: string }[] = [];

  // Gather all markdown files (recursive) first
  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const content = await fs.readFile(fullPath, 'utf8');
        mdFiles.push({ path: fullPath, content });
      }
    }
  }
  await walk(rulerDir);

  // Apply include/exclude filters
  let filteredFiles = mdFiles;
  if (options?.include || options?.exclude) {
    filteredFiles = mdFiles.filter((file) => {
      // Get relative path from rulerDir for pattern matching
      const relativePath = path.relative(rulerDir, file.path);
      // Normalize to forward slashes for consistent pattern matching
      const normalizedPath = relativePath.replace(/\\/g, '/');

      // Check exclude patterns first (they take precedence)
      if (options.exclude) {
        for (const pattern of options.exclude) {
          if (matchesPattern(normalizedPath, pattern)) {
            return false; // Exclude this file
          }
        }
      }

      // If include patterns are specified, file must match at least one
      if (options.include && options.include.length > 0) {
        for (const pattern of options.include) {
          if (matchesPattern(normalizedPath, pattern)) {
            return true; // Include this file
          }
        }
        return false; // No include pattern matched
      }

      // No include patterns specified, file passed exclude check
      return true;
    });
  }

  // Use filtered files for the rest of the processing
  const processedFiles = filteredFiles;

  // Prioritisation logic:
  // 1. Prefer top-level AGENTS.md if present.
  // 2. If AGENTS.md absent but legacy instructions.md present, use it (no longer emits a warning; legacy accepted silently).
  // 3. Include any remaining .md files (excluding whichever of the above was used if present) in
  //    sorted order AFTER the preferred primary file so that new concatenation priority starts with AGENTS.md.
  const topLevelAgents = path.join(rulerDir, 'AGENTS.md');
  const topLevelLegacy = path.join(rulerDir, 'instructions.md');

  // Separate primary candidates from others
  let primaryFile: { path: string; content: string } | null = null;
  const others: { path: string; content: string }[] = [];

  for (const f of processedFiles) {
    if (f.path === topLevelAgents) {
      primaryFile = f; // Highest priority
    }
  }
  if (!primaryFile) {
    for (const f of processedFiles) {
      if (f.path === topLevelLegacy) {
        primaryFile = f;
        break;
      }
    }
  }

  for (const f of processedFiles) {
    if (primaryFile && f.path === primaryFile.path) continue;
    others.push(f);
  }

  // Sort the remaining others for stable deterministic concatenation order.
  others.sort((a, b) => a.path.localeCompare(b.path));

  let ordered = primaryFile ? [primaryFile, ...others] : others;

  // NEW: Prepend repository root AGENTS.md (outside .ruler) if it exists and is not identical path.
  try {
    const repoRoot = path.dirname(rulerDir); // .ruler parent
    const rootAgentsPath = path.join(repoRoot, 'AGENTS.md');
    if (path.resolve(rootAgentsPath) !== path.resolve(topLevelAgents)) {
      const stat = await fs.stat(rootAgentsPath);
      if (stat.isFile()) {
        const content = await fs.readFile(rootAgentsPath, 'utf8');

        // Check if this is a generated file and we have other .ruler files
        const isGenerated = content.startsWith('<!-- Generated by Ruler -->');
        const hasRulerFiles = others.length > 0 || primaryFile !== null;

        // Additional check: if AGENTS.md contains ruler source comments and we have ruler files,
        // it's likely a corrupted generated file that should be skipped
        const containsRulerSources =
          content.includes('<!-- Source: .ruler/') ||
          content.includes('<!-- Source: ruler/');
        const isProbablyGenerated =
          isGenerated || (containsRulerSources && hasRulerFiles);

        // Skip generated AGENTS.md if we have other files in .ruler
        if (!isProbablyGenerated || !hasRulerFiles) {
          // Prepend so it has highest precedence
          ordered = [{ path: rootAgentsPath, content }, ...ordered];
        }
      }
    }
  } catch {
    // ignore if root AGENTS.md not present
  }

  return ordered;
}

/**
 * Writes content to filePath, creating parent directories if necessary.
 */
export async function writeGeneratedFile(
  filePath: string,
  content: string,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

/**
 * Creates a backup of the given filePath by copying it to filePath.bak if it exists.
 */
export async function backupFile(filePath: string): Promise<void> {
  try {
    await fs.access(filePath);
    await fs.copyFile(filePath, `${filePath}.bak`);
  } catch {
    // ignore if file does not exist
  }
}

/**
 * Ensures that the given directory exists by creating it recursively.
 */
export async function ensureDirExists(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Finds the global ruler configuration directory at XDG_CONFIG_HOME/ruler.
 * Returns the path if it exists, null otherwise.
 */
export async function findGlobalRulerDir(): Promise<string | null> {
  const globalConfigDir = path.join(getXdgConfigDir(), 'ruler');
  try {
    const stat = await fs.stat(globalConfigDir);
    if (stat.isDirectory()) {
      return globalConfigDir;
    }
  } catch {
    // ignore if global config doesn't exist
  }
  return null;
}

/**
 * Searches the entire directory tree from startPath to find all .ruler directories.
 * Returns an array of .ruler directory paths from most specific to least specific.
 */
export async function findAllRulerDirs(startPath: string): Promise<string[]> {
  const rulerDirs: string[] = [];

  // Search the entire directory tree downwards from startPath
  async function findRulerDirs(dir: string) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '.ruler') {
            rulerDirs.push(fullPath);
          } else {
            // Recursively search subdirectories (but skip hidden directories like .git)
            if (!entry.name.startsWith('.')) {
              await findRulerDirs(fullPath);
            }
          }
        }
      }
    } catch {
      // ignore errors when reading directories
    }
  }

  // Start searching from the startPath
  await findRulerDirs(startPath);

  // Sort by depth (most specific first) - deeper paths come first
  rulerDirs.sort((a, b) => {
    const depthA = a.split(path.sep).length;
    const depthB = b.split(path.sep).length;
    if (depthA !== depthB) {
      return depthB - depthA; // Deeper paths first
    }
    return a.localeCompare(b); // Alphabetical for same depth
  });

  return rulerDirs;
}
