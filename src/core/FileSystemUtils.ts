import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * Searches upwards from startPath to find a directory named .ruler.
 * Returns the path to the .ruler directory, or null if not found.
 */
export async function findRulerDir(startPath: string): Promise<string | null> {
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
  return null;
}

/**
 * Recursively reads all Markdown (.md) files in rulerDir, returning their paths and contents.
 * Files are sorted alphabetically by path.
 */
export async function readMarkdownFiles(
  rulerDir: string,
): Promise<{ path: string; content: string }[]> {
  const results: { path: string; content: string }[] = [];
  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const content = await fs.readFile(fullPath, 'utf8');
        results.push({ path: fullPath, content });
      }
    }
  }
  await walk(rulerDir);
  results.sort((a, b) => a.path.localeCompare(b.path));
  return results;
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
