import * as yaml from 'js-yaml';
import type { SubagentFrontmatter, SubagentInfo } from '../types';

type Permission = 'allow' | 'ask' | 'deny';
type Rule = Permission | Record<string, Permission>;

const TOOL_MAP: Record<string, string> = {
  Read: 'read',
  Grep: 'grep',
  Glob: 'glob',
  Bash: 'bash',
  Edit: 'edit',
  Write: 'edit',
  WebFetch: 'webfetch',
  WebSearch: 'websearch',
  Task: 'task',
  Skill: 'skill',
  TodoWrite: 'todowrite',
};

const READONLY_TOOLS = new Set([
  'read',
  'glob',
  'grep',
  'list',
  'skill',
  'webfetch',
  'websearch',
]);

function checkReadonlyOverride(name: string, key: string, rule: Rule): void {
  if (key === '*' || !READONLY_TOOLS.has(key)) {
    if (
      typeof rule === 'string'
        ? rule !== 'deny'
        : (key === '*' && rule['*'] !== 'deny') ||
          Object.values(rule).some((value) => value !== 'deny')
    ) {
      throw new Error(
        `Subagent "${name}": readonly conflicts with OpenCode permission "${key}"`,
      );
    }
  }
}

/** Render one source agent as an OpenCode native Markdown subagent. */
export function buildOpenCodeFile(sub: SubagentInfo): {
  content: string;
  warnings: string[];
} {
  if (sub.targetErrors?.opencode) {
    throw new Error(
      `Subagent "${sub.name}": OpenCode ${sub.targetErrors.opencode}`,
    );
  }
  const fm = sub.frontmatter as SubagentFrontmatter;
  const warnings: string[] = [];
  const meta: Record<string, unknown> = {
    description: fm.description,
    mode: 'subagent',
  };
  const model = fm.targets?.opencode?.model ?? fm.model;
  if (model !== undefined && model !== 'inherit') {
    const fragments = model.split('/');
    if (
      fragments.length < 2 ||
      fragments.some((part) => !part || /\s/.test(part))
    ) {
      throw new Error(
        `Subagent "${fm.name}": invalid OpenCode model "${model}"; expected provider/model`,
      );
    }
    meta.model = model;
  }

  let permission: Record<string, Rule> | undefined;
  if (fm.tools !== undefined || fm.readonly === true) {
    permission = { '*': 'deny' };
    if (fm.readonly === true && fm.tools === undefined) {
      for (const tool of READONLY_TOOLS) permission[tool] = 'allow';
    }
    for (const tool of fm.tools ?? []) {
      const mapped = Object.prototype.hasOwnProperty.call(TOOL_MAP, tool)
        ? TOOL_MAP[tool]
        : undefined;
      if (!mapped) {
        warnings.push(
          `Subagent "${fm.name}": unknown OpenCode tool "${tool}" was omitted`,
        );
      } else if (fm.readonly && !READONLY_TOOLS.has(mapped)) {
        warnings.push(
          `Subagent "${fm.name}": readonly omitted unsafe tool "${tool}"`,
        );
      } else {
        permission[mapped] = 'allow';
      }
    }
  }
  const overrides = fm.targets?.opencode?.permission;
  if (overrides !== undefined) {
    permission ??= {};
    for (const [key, rule] of Object.entries(overrides)) {
      if (fm.readonly === true) checkReadonlyOverride(fm.name, key, rule);
      // Native overrides follow generated rules in caller order. Replacing an
      // existing key in place would leave it before a later matching rule.
      delete permission[key];
      // defineProperty keeps special names such as __proto__ as ordinary data.
      Object.defineProperty(permission, key, {
        value: rule,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
  }
  if (permission !== undefined) meta.permission = permission;

  if (fm.is_background === true) {
    warnings.push(
      `Subagent "${fm.name}": OpenCode background execution is a runtime option and has no static subagent equivalent`,
    );
  }
  const body = (sub.body ?? '').replace(/^\n+/, '');
  const normalizedBody = body.endsWith('\n') ? body : `${body}\n`;
  const frontmatter = yaml
    .dump(meta, { lineWidth: -1, noRefs: true })
    .trimEnd();
  return { content: `---\n${frontmatter}\n---\n${normalizedBody}`, warnings };
}
