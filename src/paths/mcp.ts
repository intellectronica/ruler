import * as os from 'os';
import * as path from 'path';
import { promises as fs } from 'fs';

/** Determine the native MCP config path for a given agent. */
export async function getNativeMcpPath(
  adapterName: string,
  projectRoot: string,
): Promise<string | null> {
  const home = os.homedir();
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
      candidates.push(path.join(home, '.cursor', 'mcp.json'));
      break;
    case 'Windsurf':
      candidates.push(
        path.join(home, '.codeium', 'windsurf', 'mcp_config.json'),
      );
      break;
    case 'Claude Code':
      candidates.push(path.join(projectRoot, '.mcp.json'));
      break;
    case 'OpenAI Codex CLI':
      candidates.push(path.join(home, '.codex', 'config.json'));
      break;
    case 'Aider':
      candidates.push(path.join(projectRoot, '.mcp.json'));
      break;
    case 'Open Hands':
      // For Open Hands, we target the main config file, not a separate mcp.json
      candidates.push(path.join(projectRoot, '.openhands', 'config.toml'));
      break;
    case 'Gemini CLI':
      candidates.push(path.join(projectRoot, '.gemini', 'settings.json'));
      break;
    case 'Qwen Code':
      candidates.push(path.join(projectRoot, '.qwen', 'settings.json'));
      break;
    case 'Kilo Code':
      candidates.push(path.join(projectRoot, '.kilocode', 'mcp.json'));
      break;
    case 'OpenCode':
      candidates.push(path.join(projectRoot, 'opencode.json'));
      candidates.push(path.join(home, '.config', 'opencode', 'opencode.json'));
      break;
    case 'Zed':
      candidates.push(path.join(home, '.zed', 'settings.json'));
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

/** Read native MCP config from disk, or return empty object if missing/invalid. */
export async function readNativeMcp(
  filePath: string,
): Promise<Record<string, unknown>> {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Write native MCP config to disk, creating parent directories as needed. */
export async function writeNativeMcp(
  filePath: string,
  data: unknown,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const text = JSON.stringify(data, null, 2) + '\n';
  await fs.writeFile(filePath, text, 'utf8');
}
