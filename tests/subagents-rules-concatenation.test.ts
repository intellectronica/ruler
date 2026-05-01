import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { applyAllAgentConfigs } from '../src/lib';
import { CLAUDE_SUBAGENTS_PATH, RULER_SUBAGENTS_PATH } from '../src/constants';
import { _resetExperimentalWarningForTests } from '../src/core/SubagentsProcessor';
import { _resetLegacySubagentsWarningForTests } from '../src/core/ConfigLoader';

const SUBAGENT_BODY = 'You are the code-reviewer subagent.';
const SUBAGENT_SOURCE_MARKER =
  '<!-- Source: .ruler/agents/code-reviewer.md -->';

async function writeReviewerSubagent(projectRoot: string): Promise<void> {
  const dir = path.join(projectRoot, RULER_SUBAGENTS_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, 'code-reviewer.md'),
    `---\nname: code-reviewer\ndescription: Reviews code\ntools: [Read, Grep]\n---\n\n${SUBAGENT_BODY}\n`,
  );
}

async function setupRulerProject(
  projectRoot: string,
  rulerToml?: string,
): Promise<void> {
  const rulerDir = path.join(projectRoot, '.ruler');
  await fs.mkdir(rulerDir, { recursive: true });
  await fs.writeFile(
    path.join(rulerDir, 'instructions.md'),
    '# Top-level instructions\n\nMain rules.\n',
  );
  if (rulerToml !== undefined) {
    await fs.writeFile(path.join(rulerDir, 'ruler.toml'), rulerToml);
  }
}

async function runApply(projectRoot: string): Promise<void> {
  await applyAllAgentConfigs(
    projectRoot,
    ['claude'],
    undefined,
    false, // mcp disabled
    undefined,
    false, // gitignore disabled
    false,
    false,
    false,
    false,
    true,
    undefined,
    undefined,
    undefined, // subagentsEnabled — let TOML/default decide
  );
}

async function readClaudeMd(projectRoot: string): Promise<string> {
  return fs.readFile(path.join(projectRoot, 'CLAUDE.md'), 'utf8');
}

async function nativeSubagentExists(projectRoot: string): Promise<boolean> {
  try {
    await fs.access(
      path.join(projectRoot, CLAUDE_SUBAGENTS_PATH, 'code-reviewer.md'),
    );
    return true;
  } catch {
    return false;
  }
}

describe('Subagents — rules concatenation matrix', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-subagents-rules-'));
    _resetExperimentalWarningForTests();
    _resetLegacySubagentsWarningForTests();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('no [agents] section: does not propagate and does not include agents in rules', async () => {
    await setupRulerProject(tmpDir);
    await writeReviewerSubagent(tmpDir);

    await runApply(tmpDir);

    // Per spec: propagation is disabled by default when [agents].enabled is
    // not set, and `.ruler/agents/*.md` is excluded from rule concatenation.
    expect(await nativeSubagentExists(tmpDir)).toBe(false);
    const content = await readClaudeMd(tmpDir);
    expect(content).not.toContain(SUBAGENT_SOURCE_MARKER);
    expect(content).not.toContain(SUBAGENT_BODY);
  });

  it('[agents] enabled = false: does not propagate and does not include agents in rules', async () => {
    await setupRulerProject(tmpDir, '[agents]\nenabled = false\n');
    await writeReviewerSubagent(tmpDir);

    await runApply(tmpDir);

    expect(await nativeSubagentExists(tmpDir)).toBe(false);
    const content = await readClaudeMd(tmpDir);
    expect(content).not.toContain(SUBAGENT_SOURCE_MARKER);
    expect(content).not.toContain(SUBAGENT_BODY);
  });

  it('[agents] enabled = true: propagates but does not include agents in rules', async () => {
    await setupRulerProject(tmpDir, '[agents]\nenabled = true\n');
    await writeReviewerSubagent(tmpDir);

    await runApply(tmpDir);

    expect(await nativeSubagentExists(tmpDir)).toBe(true);
    const content = await readClaudeMd(tmpDir);
    expect(content).not.toContain(SUBAGENT_SOURCE_MARKER);
    expect(content).not.toContain(SUBAGENT_BODY);
  });

  it('[agents] enabled = true; include_in_rules = true: propagates and includes agents in rules', async () => {
    await setupRulerProject(
      tmpDir,
      '[agents]\nenabled = true\ninclude_in_rules = true\n',
    );
    await writeReviewerSubagent(tmpDir);

    await runApply(tmpDir);

    expect(await nativeSubagentExists(tmpDir)).toBe(true);
    const content = await readClaudeMd(tmpDir);
    expect(content).toContain(SUBAGENT_SOURCE_MARKER);
    expect(content).toContain(SUBAGENT_BODY);
  });

  it('[agents] enabled = false; include_in_rules = true: does not propagate but includes agents in rules', async () => {
    await setupRulerProject(
      tmpDir,
      '[agents]\nenabled = false\ninclude_in_rules = true\n',
    );
    await writeReviewerSubagent(tmpDir);

    await runApply(tmpDir);

    expect(await nativeSubagentExists(tmpDir)).toBe(false);
    const content = await readClaudeMd(tmpDir);
    expect(content).toContain(SUBAGENT_SOURCE_MARKER);
    expect(content).toContain(SUBAGENT_BODY);
  });
});

describe('Subagents — legacy [subagents] backward compatibility', () => {
  let tmpDir: string;
  let warnSpy: jest.SpyInstance;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ruler-subagents-legacy-'),
    );
    _resetExperimentalWarningForTests();
    _resetLegacySubagentsWarningForTests();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    warnSpy.mockRestore();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('honors legacy [subagents] enabled = true and warns once about the rename', async () => {
    await setupRulerProject(tmpDir, '[subagents]\nenabled = true\n');
    await writeReviewerSubagent(tmpDir);

    await runApply(tmpDir);

    expect(await nativeSubagentExists(tmpDir)).toBe(true);
    const warnings = warnSpy.mock.calls
      .map((args) => String(args[0]))
      .filter((m) => m.includes('[subagents]') && m.includes('deprecated'));
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });

  it('honors legacy [subagents] include_in_rules = true', async () => {
    await setupRulerProject(
      tmpDir,
      '[subagents]\nenabled = true\ninclude_in_rules = true\n',
    );
    await writeReviewerSubagent(tmpDir);

    await runApply(tmpDir);

    const content = await readClaudeMd(tmpDir);
    expect(content).toContain(SUBAGENT_SOURCE_MARKER);
    expect(content).toContain(SUBAGENT_BODY);
  });

  it('new [agents] keys take precedence over legacy [subagents]', async () => {
    // Legacy says off, new says on — propagation must run.
    await setupRulerProject(
      tmpDir,
      '[agents]\nenabled = true\n\n[subagents]\nenabled = false\n',
    );
    await writeReviewerSubagent(tmpDir);

    await runApply(tmpDir);

    expect(await nativeSubagentExists(tmpDir)).toBe(true);
  });
});
