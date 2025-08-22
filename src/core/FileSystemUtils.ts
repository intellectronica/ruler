import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

// Internal flag to ensure we only emit the legacy warning once per process.
let legacyWarningEmitted = false;
/**
 * TEST-ONLY: resets the legacy warning emission flag so unit tests can assert
 * behavior in isolation. Not documented for public use.
 */
export function __resetLegacyWarningForTests() {
  legacyWarningEmitted = false;
}

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
 * Recursively reads all Markdown (.md) files in rulerDir, returning their paths and contents.
 * Files are sorted alphabetically by path.
 */
export async function readMarkdownFiles(
  rulerDir: string,
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

  // Prioritisation logic:
  // 1. Prefer top-level AGENTS.md if present.
  // 2. If AGENTS.md absent but legacy instructions.md present, use it (emit one-time warning).
  // 3. Include any remaining .md files (excluding whichever of the above was used if present) in
  //    sorted order AFTER the preferred primary file so that new concatenation priority starts with AGENTS.md.
  const topLevelAgents = path.join(rulerDir, 'AGENTS.md');
  const topLevelLegacy = path.join(rulerDir, 'instructions.md');

  // Separate primary candidates from others
  let primaryFile: { path: string; content: string } | null = null;
  const others: { path: string; content: string }[] = [];

  for (const f of mdFiles) {
    if (f.path === topLevelAgents) {
      primaryFile = f; // Highest priority
    }
  }
  if (!primaryFile) {
    for (const f of mdFiles) {
      if (f.path === topLevelLegacy) {
        primaryFile = f;
        if (!legacyWarningEmitted) {
          console.warn(
            '[ruler] Warning: Using legacy .ruler/instructions.md. Please migrate to AGENTS.md. This fallback will be removed in a future release.',
          );
          legacyWarningEmitted = true;
        }
        break;
      }
    }
  }

  for (const f of mdFiles) {
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
        // Prepend so it has highest precedence
        ordered = [{ path: rootAgentsPath, content }, ...ordered];
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
