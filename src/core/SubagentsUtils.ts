import * as path from 'path';
import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import type { SubagentFrontmatter, SubagentInfo } from '../types';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const ACTION_ONLY_PERMISSIONS = new Set([
  'webfetch',
  'websearch',
  'todowrite',
  'question',
  'doom_loop',
]);

export interface ParsedFrontmatter {
  meta: Record<string, unknown>;
  body: string;
}

/**
 * Extracts YAML frontmatter and body from a Markdown file's contents.
 * Returns null if no frontmatter delimiter pair is present at the head of the file.
 */
export function parseFrontmatter(content: string): ParsedFrontmatter | null {
  const match = FRONTMATTER_RE.exec(content);
  if (!match) {
    return null;
  }
  const [, raw, body] = match;
  const meta = yaml.load(raw) as Record<string, unknown> | null | undefined;
  return {
    meta: meta && typeof meta === 'object' ? meta : {},
    body: body ?? '',
  };
}

/**
 * Validates a parsed frontmatter object and reads the required and optional
 * fields into a typed SubagentFrontmatter. Returns the typed value on success
 * or an error message on failure.
 */
export function validateFrontmatter(
  meta: Record<string, unknown>,
  expectedName: string,
):
  | { value: SubagentFrontmatter; targetErrors?: { opencode?: string } }
  | { error: string } {
  const name = meta.name;
  const description = meta.description;

  if (typeof name !== 'string' || name.length === 0) {
    return { error: `missing or invalid required field "name"` };
  }
  if (typeof description !== 'string' || description.length === 0) {
    return { error: `missing or invalid required field "description"` };
  }
  if (name !== expectedName) {
    return {
      error: `frontmatter name "${name}" does not match filename stem "${expectedName}"`,
    };
  }

  const fm: SubagentFrontmatter = { name, description };

  if (meta.tools !== undefined) {
    if (
      Array.isArray(meta.tools) &&
      meta.tools.every((t) => typeof t === 'string')
    ) {
      fm.tools = meta.tools as string[];
    } else if (typeof meta.tools === 'string') {
      fm.tools = meta.tools
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    } else {
      return { error: `invalid "tools" field; expected string or string[]` };
    }
  }
  if (meta.model !== undefined) {
    if (typeof meta.model !== 'string') {
      return { error: `invalid "model" field; expected string` };
    }
    fm.model = meta.model;
  }
  if (meta.readonly !== undefined) {
    if (typeof meta.readonly !== 'boolean') {
      return { error: `invalid "readonly" field; expected boolean` };
    }
    fm.readonly = meta.readonly;
  }
  if (meta.is_background !== undefined) {
    if (typeof meta.is_background !== 'boolean') {
      return { error: `invalid "is_background" field; expected boolean` };
    }
    fm.is_background = meta.is_background;
  }

  if (meta.targets !== undefined) {
    if (!isRecord(meta.targets)) {
      return {
        value: fm,
        targetErrors: { opencode: `invalid "targets" field; expected object` },
      };
    }
    if (meta.targets.opencode !== undefined) {
      if (!isRecord(meta.targets.opencode)) {
        return {
          value: fm,
          targetErrors: {
            opencode: `invalid "targets.opencode" field; expected object`,
          },
        };
      }
      const target = meta.targets.opencode;
      const opencode: NonNullable<
        NonNullable<SubagentFrontmatter['targets']>['opencode']
      > = {};
      if (target.model !== undefined) {
        if (typeof target.model !== 'string') {
          return {
            value: fm,
            targetErrors: {
              opencode: `invalid "targets.opencode.model" field; expected string`,
            },
          };
        }
        opencode.model = target.model;
      }
      if (target.permission !== undefined) {
        if (!isRecord(target.permission)) {
          return {
            value: fm,
            targetErrors: {
              opencode: `invalid "targets.opencode.permission" field; expected object`,
            },
          };
        }
        for (const [tool, rule] of Object.entries(target.permission)) {
          const actionOnly = ACTION_ONLY_PERMISSIONS.has(tool);
          if (
            !isPermissionValue(rule) &&
            (actionOnly ||
              !isRecord(rule) ||
              Object.values(rule).some((value) => !isPermissionValue(value)))
          ) {
            return {
              value: fm,
              targetErrors: {
                opencode: `invalid "targets.opencode.permission.${tool}" field; expected allow, ask, deny${actionOnly ? '' : ', or pattern rules'}`,
              },
            };
          }
        }
        opencode.permission = target.permission as NonNullable<
          typeof opencode.permission
        >;
      }
      fm.targets = { opencode };
    }
  }

  return { value: fm };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isPermissionValue(value: unknown): value is 'allow' | 'ask' | 'deny' {
  return value === 'allow' || value === 'ask' || value === 'deny';
}

/**
 * Loads a single subagent file and produces a SubagentInfo.
 * Invalid files produce a SubagentInfo with valid=false and an error string.
 */
export async function loadSubagentFile(
  filePath: string,
): Promise<SubagentInfo> {
  const stem = path.basename(filePath, '.md');
  const content = await fs.readFile(filePath, 'utf8');
  // js-yaml throws on malformed YAML; convert that into the standard
  // validation-failure shape so one bad file doesn't abort discovery.
  let parsed: ParsedFrontmatter | null;
  try {
    parsed = parseFrontmatter(content);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      name: stem,
      path: filePath,
      valid: false,
      error: `${stem}.md: invalid YAML frontmatter: ${detail}`,
    };
  }

  if (!parsed) {
    return {
      name: stem,
      path: filePath,
      valid: false,
      error: `${stem}.md: missing YAML frontmatter`,
    };
  }

  const result = validateFrontmatter(parsed.meta, stem);
  if ('error' in result) {
    return {
      name: stem,
      path: filePath,
      valid: false,
      error: `${stem}.md: ${result.error}`,
    };
  }

  return {
    name: stem,
    path: filePath,
    valid: true,
    frontmatter: result.value,
    ...(result.targetErrors ? { targetErrors: result.targetErrors } : {}),
    body: parsed.body,
  };
}

/**
 * Maps Claude Code tool names to GitHub Copilot tool aliases.
 * Unknown source tools return undefined and should be dropped (with a warning).
 */
const COPILOT_TOOL_MAP: Record<string, string> = {
  Read: 'read',
  Grep: 'search',
  Glob: 'search',
  Bash: 'execute',
  Edit: 'edit',
  Write: 'edit',
  WebFetch: 'web',
  WebSearch: 'web',
  TodoWrite: 'todo',
  Task: 'agent',
};

export interface CopilotToolMapping {
  tools: string[];
  unknown: string[];
}

/**
 * Translates Claude tool names to Copilot aliases. Deduplicates results.
 * Unknown source tools are reported separately so callers can surface a warning.
 */
export function mapToolsForCopilot(sourceTools: string[]): CopilotToolMapping {
  const mapped = new Set<string>();
  const unknown: string[] = [];
  for (const tool of sourceTools) {
    const alias = COPILOT_TOOL_MAP[tool];
    if (alias) {
      mapped.add(alias);
    } else {
      unknown.push(tool);
    }
  }
  return { tools: Array.from(mapped), unknown };
}
