import * as path from 'path';
import { promises as fs } from 'fs';
import { writeGeneratedFile } from '../core/FileSystemUtils';

/** Determine the native MCP config path for a given agent. */
export async function getNativeMcpPath(
  adapterName: string,
  projectRoot: string,
): Promise<string | null> {
  const candidates: string[] = [];
  switch (adapterName) {
    case 'GitHub Copilot':
      candidates.push(path.join(projectRoot, '.vscode', 'mcp.json'));
      break;
    case 'Visual Studio':
      candidates.push(path.join(projectRoot, '.mcp.json'));
      candidates.push(path.join(projectRoot, '.vs', 'mcp.json'));
      break;
    case 'Cursor':
      candidates.push(path.join(projectRoot, '.cursor', 'mcp.json'));
      break;
    case 'Windsurf':
      candidates.push(path.join(projectRoot, '.windsurf', 'mcp_config.json'));
      break;
    case 'Claude Code':
      candidates.push(path.join(projectRoot, '.mcp.json'));
      break;
    case 'OpenAI Codex CLI':
      candidates.push(path.join(projectRoot, '.codex', 'config.toml'));
      break;
    case 'Aider':
      candidates.push(path.join(projectRoot, '.mcp.json'));
      break;
    case 'Open Hands':
      // For Open Hands, we target the main config file, not a separate mcp.json
      candidates.push(path.join(projectRoot, 'config.toml'));
      break;
    case 'Gemini CLI':
      candidates.push(path.join(projectRoot, '.gemini', 'settings.json'));
      break;
    case 'Junie':
      candidates.push(path.join(projectRoot, '.junie', 'mcp', 'mcp.json'));
      break;
    case 'Qwen Code':
      candidates.push(path.join(projectRoot, '.qwen', 'settings.json'));
      break;
    case 'Kilo Code':
      candidates.push(path.join(projectRoot, '.kilocode', 'mcp.json'));
      break;
    case 'Kiro':
      candidates.push(path.join(projectRoot, '.kiro', 'settings', 'mcp.json'));
      break;
    case 'OpenCode':
      candidates.push(path.join(projectRoot, 'opencode.json'));
      break;
    case 'Firebase Studio':
      candidates.push(path.join(projectRoot, '.idx', 'mcp.json'));
      break;
    case 'Factory Droid':
      candidates.push(path.join(projectRoot, '.factory', 'mcp.json'));
      break;
    case 'Zed':
      // Only consider project-local Zed settings (avoid writing to user home directory)
      candidates.push(path.join(projectRoot, '.zed', 'settings.json'));
      break;
    default:
      return null;
  }
  for (const p of candidates) {
    try {
      await fs.access(p);
      return p;
    } catch {
      // continue
    }
  }
  // default to first candidate if none exist
  return candidates.length > 0 ? candidates[0] : null;
}

/** Read native MCP config from disk, or return empty object if missing. */
export async function readNativeMcp(
  filePath: string,
): Promise<Record<string, unknown>> {
  let text: string;
  try {
    text = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw new Error(
      `Could not read MCP config at ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `Invalid MCP config at ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Read native Codex TOML MCP config from disk, or return empty object if missing. */
export async function readNativeMcpToml(
  filePath: string,
  parseToml: (text: string) => Record<string, unknown>,
): Promise<Record<string, unknown>> {
  let text: string;
  try {
    text = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw new Error(
      `Could not read MCP config at ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  try {
    return parseToml(text);
  } catch (error) {
    throw new Error(
      `Invalid MCP config at ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Write native MCP config to disk, creating parent directories as needed. */
export async function writeNativeMcp(
  filePath: string,
  data: unknown,
  containmentRoot?: string,
): Promise<void> {
  const text = JSON.stringify(data, null, 2) + '\n';
  await writeGeneratedFile(filePath, text, containmentRoot);
}
