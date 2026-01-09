import * as path from 'path';
import { promises as fs } from 'fs';

/** Determine the native hooks config path for a given agent. */
export async function getNativeHooksPath(
  adapterName: string,
  projectRoot: string,
): Promise<string | null> {
  switch (adapterName) {
    case 'Claude Code':
      return path.join(projectRoot, '.claude', 'settings.json');
    case 'Gemini CLI':
      return path.join(projectRoot, '.gemini', 'settings.json');
    case 'Windsurf':
      return path.join(projectRoot, '.windsurf', 'hooks.json');
    default:
      return null;
  }
}

/** Read native hooks config from disk, or return empty object if missing/invalid. */
export async function readNativeHooks(
  filePath: string,
): Promise<Record<string, unknown>> {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Write native hooks config to disk, creating parent directories as needed. */
export async function writeNativeHooks(
  filePath: string,
  data: unknown,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const text = JSON.stringify(data, null, 2) + '\n';
  await fs.writeFile(filePath, text, 'utf8');
}
