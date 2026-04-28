import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as yaml from 'js-yaml';
import { parse as parseTOML } from '@iarna/toml';
import {
  propagateSubagentsForClaude,
  propagateSubagentsForCursor,
  propagateSubagentsForCodex,
  propagateSubagentsForCopilot,
} from '../src/core/SubagentsProcessor';
import {
  CLAUDE_SUBAGENTS_PATH,
  CURSOR_SUBAGENTS_PATH,
  CODEX_SUBAGENTS_PATH,
  COPILOT_SUBAGENTS_PATH,
} from '../src/constants';
import type { SubagentInfo } from '../src/types';

function makeSubagent(overrides: Partial<SubagentInfo> = {}): SubagentInfo {
  return {
    name: 'reviewer',
    path: '/virtual/reviewer.md',
    valid: true,
    frontmatter: {
      name: 'reviewer',
      description: 'Reviews code',
      ...(overrides.frontmatter ?? {}),
    },
    body: 'You review code.\n',
    ...overrides,
  };
}

function readFrontmatter(content: string): {
  meta: Record<string, unknown>;
  body: string;
} {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(content);
  if (!match) {
    throw new Error(`No frontmatter found in:\n${content}`);
  }
  const meta = yaml.load(match[1]) as Record<string, unknown>;
  return { meta, body: match[2] };
}

describe('Subagents per-agent propagators', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-subagents-prop-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('Claude propagator', () => {
    it('writes a passthrough markdown file preserving all source frontmatter', async () => {
      const sub = makeSubagent({
        frontmatter: {
          name: 'reviewer',
          description: 'Reviews code',
          tools: ['Read', 'Grep'],
          model: 'inherit',
          readonly: true,
          is_background: false,
        },
      });

      await propagateSubagentsForClaude(tmpDir, [sub], { dryRun: false });

      const target = path.join(tmpDir, CLAUDE_SUBAGENTS_PATH, 'reviewer.md');
      const content = await fs.readFile(target, 'utf8');
      const { meta, body } = readFrontmatter(content);

      expect(meta.name).toBe('reviewer');
      expect(meta.description).toBe('Reviews code');
      expect(meta.tools).toEqual(['Read', 'Grep']);
      expect(meta.model).toBe('inherit');
      expect(meta.readonly).toBe(true);
      expect(meta.is_background).toBe(false);
      expect(body.trim()).toBe('You review code.');
    });

    it('omits optional fields when absent in source', async () => {
      const sub = makeSubagent();
      await propagateSubagentsForClaude(tmpDir, [sub], { dryRun: false });
      const target = path.join(tmpDir, CLAUDE_SUBAGENTS_PATH, 'reviewer.md');
      const content = await fs.readFile(target, 'utf8');
      const { meta } = readFrontmatter(content);
      expect(meta.tools).toBeUndefined();
      expect(meta.model).toBeUndefined();
    });

    it('does not write files in dry-run mode', async () => {
      const sub = makeSubagent();
      await propagateSubagentsForClaude(tmpDir, [sub], { dryRun: true });
      await expect(
        fs.access(path.join(tmpDir, CLAUDE_SUBAGENTS_PATH)),
      ).rejects.toThrow();
    });

    it('replaces existing target directory atomically', async () => {
      // First write
      await propagateSubagentsForClaude(
        tmpDir,
        [makeSubagent({ name: 'old', frontmatter: { name: 'old', description: 'old' }, path: '/v/old.md' })],
        { dryRun: false },
      );
      const oldTarget = path.join(tmpDir, CLAUDE_SUBAGENTS_PATH, 'old.md');
      await expect(fs.access(oldTarget)).resolves.toBeUndefined();

      // Second write replaces
      await propagateSubagentsForClaude(tmpDir, [makeSubagent()], {
        dryRun: false,
      });
      await expect(fs.access(oldTarget)).rejects.toThrow();
      await expect(
        fs.access(path.join(tmpDir, CLAUDE_SUBAGENTS_PATH, 'reviewer.md')),
      ).resolves.toBeUndefined();
    });
  });

  describe('Cursor propagator', () => {
    it('drops tools and applies defaults for absent fields', async () => {
      const sub = makeSubagent({
        frontmatter: {
          name: 'reviewer',
          description: 'Reviews code',
          tools: ['Read', 'Grep'],
        },
      });

      await propagateSubagentsForCursor(tmpDir, [sub], { dryRun: false });
      const target = path.join(tmpDir, CURSOR_SUBAGENTS_PATH, 'reviewer.md');
      const content = await fs.readFile(target, 'utf8');
      const { meta, body } = readFrontmatter(content);

      expect(meta.tools).toBeUndefined();
      expect(meta.name).toBe('reviewer');
      expect(meta.description).toBe('Reviews code');
      expect(meta.model).toBe('inherit');
      expect(meta.readonly).toBe(false);
      expect(meta.is_background).toBe(false);
      expect(body.trim()).toBe('You review code.');
    });

    it('passes readonly: true through verbatim', async () => {
      const sub = makeSubagent({
        frontmatter: {
          name: 'reviewer',
          description: 'Reviews code',
          readonly: true,
        },
      });
      await propagateSubagentsForCursor(tmpDir, [sub], { dryRun: false });
      const content = await fs.readFile(
        path.join(tmpDir, CURSOR_SUBAGENTS_PATH, 'reviewer.md'),
        'utf8',
      );
      const { meta } = readFrontmatter(content);
      expect(meta.readonly).toBe(true);
    });
  });

  describe('Codex propagator', () => {
    it('writes a self-contained TOML file with required fields', async () => {
      const sub = makeSubagent({
        frontmatter: {
          name: 'reviewer',
          description: 'Reviews code',
          model: 'gpt-5',
          readonly: true,
        },
      });
      await propagateSubagentsForCodex(tmpDir, [sub], { dryRun: false });

      const target = path.join(tmpDir, CODEX_SUBAGENTS_PATH, 'reviewer.toml');
      const raw = await fs.readFile(target, 'utf8');
      const parsed = parseTOML(raw) as Record<string, unknown>;

      expect(parsed.name).toBe('reviewer');
      expect(parsed.description).toBe('Reviews code');
      expect(parsed.developer_instructions).toContain('You review code.');
      expect(parsed.model).toBe('gpt-5');
      expect(parsed.sandbox_mode).toBe('read-only');
    });

    it('omits model when set to inherit', async () => {
      const sub = makeSubagent({
        frontmatter: {
          name: 'reviewer',
          description: 'Reviews code',
          model: 'inherit',
        },
      });
      await propagateSubagentsForCodex(tmpDir, [sub], { dryRun: false });
      const raw = await fs.readFile(
        path.join(tmpDir, CODEX_SUBAGENTS_PATH, 'reviewer.toml'),
        'utf8',
      );
      const parsed = parseTOML(raw) as Record<string, unknown>;
      expect(parsed.model).toBeUndefined();
    });

    it('omits sandbox_mode when readonly is not set', async () => {
      const sub = makeSubagent();
      await propagateSubagentsForCodex(tmpDir, [sub], { dryRun: false });
      const raw = await fs.readFile(
        path.join(tmpDir, CODEX_SUBAGENTS_PATH, 'reviewer.toml'),
        'utf8',
      );
      const parsed = parseTOML(raw) as Record<string, unknown>;
      expect(parsed.sandbox_mode).toBeUndefined();
    });

    it('preserves multiline body content through TOML round-trip', async () => {
      const body = 'Line 1\nLine 2 with "quotes"\nLine 3 with \\backslash\n';
      const sub = makeSubagent({ body });
      await propagateSubagentsForCodex(tmpDir, [sub], { dryRun: false });
      const raw = await fs.readFile(
        path.join(tmpDir, CODEX_SUBAGENTS_PATH, 'reviewer.toml'),
        'utf8',
      );
      const parsed = parseTOML(raw) as Record<string, unknown>;
      expect(parsed.developer_instructions).toBe(body);
    });
  });

  describe('Copilot propagator', () => {
    it('maps Claude tools to Copilot aliases and dedupes', async () => {
      const sub = makeSubagent({
        frontmatter: {
          name: 'reviewer',
          description: 'Reviews code',
          tools: ['Read', 'Grep', 'Glob', 'Bash'],
        },
      });

      await propagateSubagentsForCopilot(tmpDir, [sub], { dryRun: false });

      const target = path.join(tmpDir, COPILOT_SUBAGENTS_PATH, 'reviewer.md');
      const content = await fs.readFile(target, 'utf8');
      const { meta } = readFrontmatter(content);

      expect(Array.isArray(meta.tools)).toBe(true);
      const tools = meta.tools as string[];
      // Read→read, Grep→search, Glob→search (deduped), Bash→execute
      expect(tools).toContain('read');
      expect(tools).toContain('search');
      expect(tools).toContain('execute');
      expect(tools.filter((t) => t === 'search')).toHaveLength(1);
    });

    it('derives disable-model-invocation from readonly: true', async () => {
      const sub = makeSubagent({
        frontmatter: {
          name: 'reviewer',
          description: 'Reviews code',
          readonly: true,
        },
      });
      await propagateSubagentsForCopilot(tmpDir, [sub], { dryRun: false });
      const content = await fs.readFile(
        path.join(tmpDir, COPILOT_SUBAGENTS_PATH, 'reviewer.md'),
        'utf8',
      );
      const { meta } = readFrontmatter(content);
      expect(meta['disable-model-invocation']).toBe(true);
      expect(meta['user-invocable']).toBe(true);
    });

    it('omits tools when source has none', async () => {
      const sub = makeSubagent();
      await propagateSubagentsForCopilot(tmpDir, [sub], { dryRun: false });
      const content = await fs.readFile(
        path.join(tmpDir, COPILOT_SUBAGENTS_PATH, 'reviewer.md'),
        'utf8',
      );
      const { meta } = readFrontmatter(content);
      expect(meta.tools).toBeUndefined();
    });

    it('omits model when source uses inherit', async () => {
      const sub = makeSubagent({
        frontmatter: {
          name: 'reviewer',
          description: 'Reviews code',
          model: 'inherit',
        },
      });
      await propagateSubagentsForCopilot(tmpDir, [sub], { dryRun: false });
      const content = await fs.readFile(
        path.join(tmpDir, COPILOT_SUBAGENTS_PATH, 'reviewer.md'),
        'utf8',
      );
      const { meta } = readFrontmatter(content);
      expect(meta.model).toBeUndefined();
    });
  });
});
