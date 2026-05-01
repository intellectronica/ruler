import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { readMarkdownFiles } from '../../../src/core/FileSystemUtils';
import { RULER_SUBAGENTS_PATH, SKILLS_DIR } from '../../../src/constants';

const SUBAGENTS_DIR_NAME = path.basename(RULER_SUBAGENTS_PATH);

describe('FileSystemUtils - agents (subagent) exclusion', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-agents-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function setupFixture(): Promise<{
    rulerDir: string;
    rootAgents: string;
    extraRule: string;
    agentFile: string;
    skillFile: string;
  }> {
    const rulerDir = path.join(tmpDir, '.ruler');
    const agentsDir = path.join(rulerDir, SUBAGENTS_DIR_NAME);
    const skillsDir = path.join(rulerDir, SKILLS_DIR, 'effect');
    await fs.mkdir(agentsDir, { recursive: true });
    await fs.mkdir(skillsDir, { recursive: true });

    const rootAgents = path.join(rulerDir, 'AGENTS.md');
    const extraRule = path.join(rulerDir, 'guide.md');
    const agentFile = path.join(agentsDir, 'reviewer.md');
    const skillFile = path.join(skillsDir, 'SKILL.md');

    await fs.writeFile(rootAgents, '# Root rules');
    await fs.writeFile(extraRule, 'Additional guidance');
    await fs.writeFile(
      agentFile,
      '---\nname: reviewer\ndescription: Reviews code\n---\n\nbody',
    );
    await fs.writeFile(skillFile, '# Skill content');

    return { rulerDir, rootAgents, extraRule, agentFile, skillFile };
  }

  it('skips .ruler/agents by default (no options)', async () => {
    const { rulerDir, rootAgents, extraRule, agentFile, skillFile } =
      await setupFixture();

    const files = await readMarkdownFiles(rulerDir);
    const paths = files.map((f) => f.path);

    expect(paths).toEqual(expect.arrayContaining([rootAgents, extraRule]));
    expect(paths).toEqual(expect.not.arrayContaining([agentFile, skillFile]));
    expect(paths).toHaveLength(2);
  });

  it('skips .ruler/agents when includeAgents is explicitly false', async () => {
    const { rulerDir, agentFile } = await setupFixture();
    const files = await readMarkdownFiles(rulerDir, { includeAgents: false });
    expect(files.map((f) => f.path)).toEqual(
      expect.not.arrayContaining([agentFile]),
    );
  });

  it('includes .ruler/agents when includeAgents is true', async () => {
    const { rulerDir, rootAgents, extraRule, agentFile, skillFile } =
      await setupFixture();

    const files = await readMarkdownFiles(rulerDir, { includeAgents: true });
    const paths = files.map((f) => f.path);

    expect(paths).toEqual(
      expect.arrayContaining([rootAgents, extraRule, agentFile]),
    );
    // Skills must still be excluded — this option only affects agents.
    expect(paths).toEqual(expect.not.arrayContaining([skillFile]));
    expect(paths).toHaveLength(3);
  });

  it('still skips .ruler/skills even when includeAgents is true', async () => {
    const { rulerDir, skillFile } = await setupFixture();
    const files = await readMarkdownFiles(rulerDir, { includeAgents: true });
    expect(files.map((f) => f.path)).toEqual(
      expect.not.arrayContaining([skillFile]),
    );
  });

  it('does not resurrect a stale generated root AGENTS.md when only .ruler/agents existed', async () => {
    // Repro of CodeRabbit finding: .ruler contains only agent markdown (now
    // excluded by default), AND a previously-generated root AGENTS.md sits
    // beside .ruler containing the very agent doc we're trying to exclude.
    // The fallback path must NOT prepend that stale generated file.
    const repoRoot = tmpDir;
    const rulerDir = path.join(repoRoot, '.ruler');
    const agentsDir = path.join(rulerDir, SUBAGENTS_DIR_NAME);
    await fs.mkdir(agentsDir, { recursive: true });
    await fs.writeFile(
      path.join(agentsDir, 'reviewer.md'),
      '---\nname: reviewer\ndescription: Reviews code\n---\n\nbody',
    );
    const staleRootAgents = path.join(repoRoot, 'AGENTS.md');
    await fs.writeFile(
      staleRootAgents,
      '<!-- Source: .ruler/agents/reviewer.md -->\n\nbody from previous bugged run',
    );

    const files = await readMarkdownFiles(rulerDir); // default: skip agents
    expect(files.map((f) => f.path)).toEqual(
      expect.not.arrayContaining([staleRootAgents]),
    );
  });

  it('recurses into nested directories under .ruler/agents when included', async () => {
    const rulerDir = path.join(tmpDir, '.ruler');
    const nested = path.join(rulerDir, SUBAGENTS_DIR_NAME, 'nested');
    await fs.mkdir(nested, { recursive: true });
    const nestedFile = path.join(nested, 'inner.md');
    await fs.writeFile(nestedFile, 'inner agent body');
    await fs.writeFile(path.join(rulerDir, 'AGENTS.md'), '# rules');

    const skipped = await readMarkdownFiles(rulerDir);
    expect(skipped.map((f) => f.path)).toEqual(
      expect.not.arrayContaining([nestedFile]),
    );

    const included = await readMarkdownFiles(rulerDir, { includeAgents: true });
    expect(included.map((f) => f.path)).toEqual(
      expect.arrayContaining([nestedFile]),
    );
  });
});
