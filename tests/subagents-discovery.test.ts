import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { discoverSubagents } from '../src/core/SubagentsProcessor';
import { RULER_SUBAGENTS_PATH } from '../src/constants';

describe('Subagents discovery', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-subagents-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function writeAgent(name: string, content: string): Promise<void> {
    const dir = path.join(tmpDir, RULER_SUBAGENTS_PATH);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${name}.md`), content);
  }

  it('returns empty list when .ruler/agents/ does not exist', async () => {
    const result = await discoverSubagents(tmpDir);
    expect(result.subagents).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('returns empty list when .ruler/agents/ is empty', async () => {
    await fs.mkdir(path.join(tmpDir, RULER_SUBAGENTS_PATH), { recursive: true });
    const result = await discoverSubagents(tmpDir);
    expect(result.subagents).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('discovers a valid subagent with full frontmatter', async () => {
    await writeAgent(
      'code-reviewer',
      `---
name: code-reviewer
description: Reviews code for quality
tools: [Read, Grep, Glob]
model: inherit
readonly: true
is_background: false
---

You are a code reviewer.
`,
    );

    const result = await discoverSubagents(tmpDir);

    expect(result.warnings).toHaveLength(0);
    expect(result.subagents).toHaveLength(1);
    const agent = result.subagents[0];
    expect(agent.valid).toBe(true);
    expect(agent.name).toBe('code-reviewer');
    expect(agent.frontmatter?.description).toBe('Reviews code for quality');
    expect(agent.frontmatter?.tools).toEqual(['Read', 'Grep', 'Glob']);
    expect(agent.frontmatter?.model).toBe('inherit');
    expect(agent.frontmatter?.readonly).toBe(true);
    expect(agent.frontmatter?.is_background).toBe(false);
    expect(agent.body?.trim()).toBe('You are a code reviewer.');
  });

  it('discovers multiple subagents', async () => {
    await writeAgent(
      'reviewer',
      `---
name: reviewer
description: Reviews
---
Body 1
`,
    );
    await writeAgent(
      'tester',
      `---
name: tester
description: Tests
---
Body 2
`,
    );

    const result = await discoverSubagents(tmpDir);
    expect(result.subagents).toHaveLength(2);
    expect(result.subagents.every((s) => s.valid)).toBe(true);
  });

  it('warns and skips files without frontmatter', async () => {
    await writeAgent('plain', '# Just a heading, no frontmatter');

    const result = await discoverSubagents(tmpDir);
    expect(result.subagents).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/plain/);
  });

  it('warns and skips files where name does not match filename', async () => {
    await writeAgent(
      'mismatch',
      `---
name: different-name
description: x
---
body
`,
    );

    const result = await discoverSubagents(tmpDir);
    expect(result.subagents).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/mismatch/);
  });

  it('warns and skips files missing required name field', async () => {
    await writeAgent(
      'noname',
      `---
description: missing name
---
body
`,
    );

    const result = await discoverSubagents(tmpDir);
    expect(result.subagents).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('warns and skips files missing required description field', async () => {
    await writeAgent(
      'nodesc',
      `---
name: nodesc
---
body
`,
    );

    const result = await discoverSubagents(tmpDir);
    expect(result.subagents).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('ignores non-.md files', async () => {
    const dir = path.join(tmpDir, RULER_SUBAGENTS_PATH);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'README.txt'), 'not an agent');

    const result = await discoverSubagents(tmpDir);
    expect(result.subagents).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });
});
