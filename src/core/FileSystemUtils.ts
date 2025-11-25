import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parseFrontmatter } from './FrontmatterParser';
import { MergeStrategy } from '../types';

/**
 * Gets the XDG config directory path, falling back to ~/.config if XDG_CONFIG_HOME is not set.
 */
function getXdgConfigDir(): string {
  return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
}

/**
 * Searches upwards from startPath to find a .claude directory with skiller.toml.
 * If not found locally and checkGlobal is true, checks for global config at XDG_CONFIG_HOME/skiller.
 * Returns the path to the found directory, or null if not found.
 */
export async function findSkillerDir(
  startPath: string,
  checkGlobal: boolean = true,
): Promise<string | null> {
  // Search upwards from startPath for local .claude directory with skiller.toml
  let current = startPath;
  while (current) {
    const claudeCandidate = path.join(current, '.claude');
    try {
      const stat = await fs.stat(claudeCandidate);
      if (stat.isDirectory()) {
        // Check if this .claude directory has skiller.toml
        const tomlPath = path.join(claudeCandidate, 'skiller.toml');
        try {
          await fs.stat(tomlPath);
          return claudeCandidate;
        } catch {
          // .claude exists but no skiller.toml, continue searching
        }
      }
    } catch {
      // ignore errors when checking for .claude directory
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  // If no local .claude found and checkGlobal is true, check global config directory
  if (checkGlobal) {
    const globalConfigDir = path.join(getXdgConfigDir(), 'skiller');
    try {
      const stat = await fs.stat(globalConfigDir);
      if (stat.isDirectory()) {
        return globalConfigDir;
      }
    } catch (err) {
      console.error(
        `[skiller] Error checking global config directory ${globalConfigDir}:`,
        err,
      );
    }
  }

  return null;
}

// Alias for backward compatibility
export const findRulerDir = findSkillerDir;

/**
 * Normalizes a pattern by expanding directory patterns to glob patterns.
 * Directory patterns (no wildcards, no .md/.mdc extension) are expanded to match all markdown files.
 * @example "rules-global" becomes a pattern matching both .md and .mdc files
 * @example "rules-global/star.md" stays unchanged
 * @example "AGENTS.md" stays unchanged
 */
export function normalizePattern(pattern: string): string {
  // If pattern already contains wildcards or is a specific markdown file, return as-is
  if (
    pattern.includes('*') ||
    pattern.endsWith('.md') ||
    pattern.endsWith('.mdc')
  ) {
    return pattern;
  }

  // Otherwise, treat as directory and expand to include all .md/.mdc files recursively
  // We'll return the .md pattern, but the file walker will pick up both .md and .mdc
  return `${pattern}/**/*.{md,mdc}`;
}

/**
 * Simple glob pattern matcher supporting basic patterns:
 * - `*` matches any characters except `/`
 * - `**` matches any characters including `/` (zero or more path segments)
 * - `{md,mdc}` matches either md or mdc
 * - Exact string matches
 */
export function matchesPattern(filePath: string, pattern: string): boolean {
  // Handle brace expansion {md,mdc} -> (md|mdc)
  let expandedPattern = pattern;
  const braceMatch = pattern.match(/\{([^}]+)\}/);
  if (braceMatch) {
    const options = braceMatch[1].split(',');
    expandedPattern = pattern.replace(braceMatch[0], `(${options.join('|')})`);
  }

  // Convert glob pattern to regex
  // Escape special regex characters except * / ( ) |
  let regexPattern = expandedPattern
    .replace(/[.+?^${}[\]\\]/g, '\\$&')
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
 * Recursively reads all Markdown (.md and .mdc) files in skillerDir, returning their paths and contents.
 * Files are sorted alphabetically by path.
 *
 * @param skillerDir The directory to scan for markdown files
 * @param options Optional filtering configuration
 * @param options.include Glob patterns to include (if specified, only matching files are included)
 * @param options.exclude Glob patterns to exclude (takes precedence over include)
 * @param options.merge_strategy Merge strategy: 'all' (default) or 'cursor' (uses MDC frontmatter)
 */
export async function readMarkdownFiles(
  skillerDir: string,
  options?: {
    include?: string[];
    exclude?: string[];
    merge_strategy?: MergeStrategy;
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
      } else if (
        entry.isFile() &&
        (entry.name.endsWith('.md') || entry.name.endsWith('.mdc'))
      ) {
        const content = await fs.readFile(fullPath, 'utf8');
        mdFiles.push({ path: fullPath, content });
      }
    }
  }
  await walk(skillerDir);

  // Apply include/exclude filters
  let filteredFiles = mdFiles;
  if (options?.include || options?.exclude) {
    // Normalize patterns (expand directory patterns to globs)
    const normalizedInclude = options.include?.map(normalizePattern);
    const normalizedExclude = options.exclude?.map(normalizePattern);

    filteredFiles = mdFiles.filter((file) => {
      // Get relative path from skillerDir for pattern matching
      const relativePath = path.relative(skillerDir, file.path);
      // Normalize to forward slashes for consistent pattern matching
      const normalizedPath = relativePath.replace(/\\/g, '/');

      // Check exclude patterns first (they take precedence)
      if (normalizedExclude) {
        for (const pattern of normalizedExclude) {
          if (matchesPattern(normalizedPath, pattern)) {
            return false; // Exclude this file
          }
        }
      }

      // If include patterns are specified, file must match at least one
      if (normalizedInclude && normalizedInclude.length > 0) {
        for (const pattern of normalizedInclude) {
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

  // Apply cursor mode filtering if enabled
  let processedFiles = filteredFiles;
  if (options?.merge_strategy === 'cursor') {
    const cursorFiles: { path: string; content: string }[] = [];

    for (const file of filteredFiles) {
      const relativePath = path.relative(skillerDir, file.path);
      const normalizedPath = relativePath.replace(/\\/g, '/');

      // Always include AGENTS.md for backward compatibility
      if (/^AGENTS\.md$/i.test(normalizedPath)) {
        cursorFiles.push(file);
        continue;
      }

      // Check if file is in rules/ folder and is .mdc
      if (normalizedPath.startsWith('rules/') && file.path.endsWith('.mdc')) {
        // Parse frontmatter
        const parsed = parseFrontmatter(file.content);

        // Only include if alwaysApply is true
        if (parsed.frontmatter?.alwaysApply === true) {
          // Strip frontmatter from content
          cursorFiles.push({
            path: file.path,
            content: parsed.body,
          });
        }
      }
    }

    processedFiles = cursorFiles;
  }

  // Prioritisation logic:
  // 1. Prefer top-level AGENTS.md if present.
  // 2. If AGENTS.md absent but legacy instructions.md present, use it (no longer emits a warning; legacy accepted silently).
  // 3. Include any remaining .md files (excluding whichever of the above was used if present) in
  //    sorted order AFTER the preferred primary file so that new concatenation priority starts with AGENTS.md.
  const topLevelAgents = path.join(skillerDir, 'AGENTS.md');
  const topLevelLegacy = path.join(skillerDir, 'instructions.md');

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

  // NEW: Prepend repository root AGENTS.md (outside .claude) if it exists and is not identical path.
  try {
    const repoRoot = path.dirname(skillerDir); // .claude parent
    const rootAgentsPath = path.join(repoRoot, 'AGENTS.md');
    if (path.resolve(rootAgentsPath) !== path.resolve(topLevelAgents)) {
      const stat = await fs.stat(rootAgentsPath);
      if (stat.isFile()) {
        const content = await fs.readFile(rootAgentsPath, 'utf8');

        // Check if this is a generated file and we have other .claude files
        const isGenerated = content.startsWith('<!-- Generated by Skiller -->');
        const hasSkillerFiles = others.length > 0 || primaryFile !== null;

        // Additional check: if AGENTS.md contains skiller source comments and we have skiller files,
        // it's likely a corrupted generated file that should be skipped
        const containsSkillerSources =
          content.includes('<!-- Source: .claude/') ||
          content.includes('<!-- Source: claude/');
        const isProbablyGenerated =
          isGenerated || (containsSkillerSources && hasSkillerFiles);

        // Skip generated AGENTS.md if we have other files in .claude
        if (!isProbablyGenerated || !hasSkillerFiles) {
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
 * Finds the global skiller configuration directory at XDG_CONFIG_HOME/skiller.
 * Returns the path if it exists, null otherwise.
 */
export async function findGlobalSkillerDir(): Promise<string | null> {
  const globalConfigDir = path.join(getXdgConfigDir(), 'skiller');
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

// Alias for backward compatibility
export const findGlobalRulerDir = findGlobalSkillerDir;

/**
 * Searches the entire directory tree from startPath to find all .claude directories with skiller.toml.
 * Returns an array of directory paths from most specific to least specific.
 */
export async function findAllSkillerDirs(startPath: string): Promise<string[]> {
  const skillerDirs: string[] = [];

  // Search the entire directory tree downwards from startPath
  async function findSkillerDirsRecursive(dir: string) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '.claude') {
            // Check if .claude has skiller.toml
            const tomlPath = path.join(fullPath, 'skiller.toml');
            try {
              await fs.stat(tomlPath);
              skillerDirs.push(fullPath);
            } catch {
              // .claude exists but no skiller.toml
            }
          } else {
            // Recursively search subdirectories (but skip hidden directories like .git)
            if (!entry.name.startsWith('.')) {
              await findSkillerDirsRecursive(fullPath);
            }
          }
        }
      }
    } catch {
      // ignore errors when reading directories
    }
  }

  // Start searching from the startPath
  await findSkillerDirsRecursive(startPath);

  // Sort by depth (most specific first) - deeper paths come first
  skillerDirs.sort((a, b) => {
    const depthA = a.split(path.sep).length;
    const depthB = b.split(path.sep).length;
    if (depthA !== depthB) {
      return depthB - depthA; // Deeper paths first
    }
    return a.localeCompare(b); // Alphabetical for same depth
  });

  return skillerDirs;
}

// Alias for backward compatibility
export const findAllRulerDirs = findAllSkillerDirs;
