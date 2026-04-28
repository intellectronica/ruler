import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { applyAllAgentConfigs } from '../src/lib';
import {
  CLAUDE_SUBAGENTS_PATH,
  CURSOR_SUBAGENTS_PATH,
  CODEX_SUBAGENTS_PATH,
  COPILOT_SUBAGENTS_PATH,
  RULER_SUBAGENTS_PATH,
} from '../src/constants';
import { _resetExperimentalWarningForTests } from '../src/core/SubagentsProcessor';

async function writeSubagent(
  projectRoot: string,
  name: string,
  body = 'You are an agent.',
): Promise<void> {
  const dir = path.join(projectRoot, RULER_SUBAGENTS_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, `${name}.md`),
    `---\nname: ${name}\ndescription: Test subagent ${name}\ntools: [Read, Grep]\nreadonly: true\n---\n\n${body}\n`,
  );
}

async function setupRulerProject(projectRoot: string): Promise<void> {
  const rulerDir = path.join(projectRoot, '.ruler');
  await fs.mkdir(rulerDir, { recursive: true });
  await fs.writeFile(
    path.join(rulerDir, 'AGENTS.md'),
    '# Project Rules\n\nBe helpful.\n',
  );
}

describe('Subagents apply integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-subagents-cli-'));
    _resetExperimentalWarningForTests();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('writes subagents to all four targets when default applies to claude+cursor+codex+copilot', async () => {
    await setupRulerProject(tmpDir);
    await writeSubagent(tmpDir, 'reviewer');

    await applyAllAgentConfigs(
      tmpDir,
      ['claude', 'cursor', 'codex', 'copilot'],
      undefined,
      false, // mcp disabled (avoids unrelated MCP setup in tests)
      undefined,
      false, // gitignore disabled to keep test focused
      false,
      false,
      false,
      false,
      true,
      undefined,
      undefined,
      undefined,
    );

    await expect(
      fs.access(path.join(tmpDir, CLAUDE_SUBAGENTS_PATH, 'reviewer.md')),
    ).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(tmpDir, CURSOR_SUBAGENTS_PATH, 'reviewer.md')),
    ).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(tmpDir, CODEX_SUBAGENTS_PATH, 'reviewer.toml')),
    ).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(tmpDir, COPILOT_SUBAGENTS_PATH, 'reviewer.md')),
    ).resolves.toBeUndefined();
  });

  it('respects subagentsEnabled=false (CLI override) and skips propagation', async () => {
    await setupRulerProject(tmpDir);
    await writeSubagent(tmpDir, 'reviewer');

    await applyAllAgentConfigs(
      tmpDir,
      ['claude'],
      undefined,
      false,
      undefined,
      false,
      false,
      false,
      false,
      false,
      true,
      undefined,
      undefined,
      false, // subagentsEnabled
    );

    await expect(
      fs.access(path.join(tmpDir, CLAUDE_SUBAGENTS_PATH)),
    ).rejects.toThrow();
  });

  it('cleans up existing target directories when subagentsEnabled=false', async () => {
    await setupRulerProject(tmpDir);
    await writeSubagent(tmpDir, 'reviewer');

    // First run: enabled
    await applyAllAgentConfigs(
      tmpDir,
      ['claude', 'cursor'],
      undefined,
      false,
      undefined,
      false,
      false,
      false,
      false,
      false,
      true,
      undefined,
      undefined,
      true,
    );
    await expect(
      fs.access(path.join(tmpDir, CLAUDE_SUBAGENTS_PATH, 'reviewer.md')),
    ).resolves.toBeUndefined();

    // Second run: disabled — directories should be removed
    await applyAllAgentConfigs(
      tmpDir,
      ['claude', 'cursor'],
      undefined,
      false,
      undefined,
      false,
      false,
      false,
      false,
      false,
      true,
      undefined,
      undefined,
      false,
    );
    await expect(
      fs.access(path.join(tmpDir, CLAUDE_SUBAGENTS_PATH)),
    ).rejects.toThrow();
    await expect(
      fs.access(path.join(tmpDir, CURSOR_SUBAGENTS_PATH)),
    ).rejects.toThrow();
  });

  it('respects [subagents] enabled = false in ruler.toml', async () => {
    await setupRulerProject(tmpDir);
    await writeSubagent(tmpDir, 'reviewer');
    await fs.writeFile(
      path.join(tmpDir, '.ruler', 'ruler.toml'),
      '[subagents]\nenabled = false\n',
    );

    await applyAllAgentConfigs(
      tmpDir,
      ['claude'],
      undefined,
      false,
      undefined,
      false,
      false,
      false,
      false,
      false,
      true,
      undefined,
      undefined,
      undefined, // CLI not set: TOML wins
    );

    await expect(
      fs.access(path.join(tmpDir, CLAUDE_SUBAGENTS_PATH)),
    ).rejects.toThrow();
  });

  it('CLI flag overrides TOML setting', async () => {
    await setupRulerProject(tmpDir);
    await writeSubagent(tmpDir, 'reviewer');
    await fs.writeFile(
      path.join(tmpDir, '.ruler', 'ruler.toml'),
      '[subagents]\nenabled = false\n',
    );

    await applyAllAgentConfigs(
      tmpDir,
      ['claude'],
      undefined,
      false,
      undefined,
      false,
      false,
      false,
      false,
      false,
      true,
      undefined,
      undefined,
      true, // CLI override
    );

    await expect(
      fs.access(path.join(tmpDir, CLAUDE_SUBAGENTS_PATH, 'reviewer.md')),
    ).resolves.toBeUndefined();
  });

  it('removes target directories that drop out of the selected agent set', async () => {
    await setupRulerProject(tmpDir);
    await writeSubagent(tmpDir, 'reviewer');

    // First run: claude + cursor selected — both targets get written.
    await applyAllAgentConfigs(
      tmpDir,
      ['claude', 'cursor'],
      undefined,
      false,
      undefined,
      false,
      false,
      false,
      false,
      false,
      true,
      undefined,
      undefined,
      true,
    );
    await expect(
      fs.access(path.join(tmpDir, CLAUDE_SUBAGENTS_PATH, 'reviewer.md')),
    ).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(tmpDir, CURSOR_SUBAGENTS_PATH, 'reviewer.md')),
    ).resolves.toBeUndefined();

    // Second run: only claude — cursor's target dir must be cleaned up.
    await applyAllAgentConfigs(
      tmpDir,
      ['claude'],
      undefined,
      false,
      undefined,
      false,
      false,
      false,
      false,
      false,
      true,
      undefined,
      undefined,
      true,
    );
    await expect(
      fs.access(path.join(tmpDir, CLAUDE_SUBAGENTS_PATH, 'reviewer.md')),
    ).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(tmpDir, CURSOR_SUBAGENTS_PATH)),
    ).rejects.toThrow();
  });

  it('cleans up all target directories when source .ruler/agents is removed', async () => {
    await setupRulerProject(tmpDir);
    await writeSubagent(tmpDir, 'reviewer');

    await applyAllAgentConfigs(
      tmpDir,
      ['claude', 'cursor', 'codex', 'copilot'],
      undefined,
      false,
      undefined,
      false,
      false,
      false,
      false,
      false,
      true,
      undefined,
      undefined,
      true,
    );
    await expect(
      fs.access(path.join(tmpDir, CLAUDE_SUBAGENTS_PATH, 'reviewer.md')),
    ).resolves.toBeUndefined();

    // Remove source dir, then re-apply. All target dirs should be cleaned up.
    await fs.rm(path.join(tmpDir, RULER_SUBAGENTS_PATH), {
      recursive: true,
      force: true,
    });

    await applyAllAgentConfigs(
      tmpDir,
      ['claude', 'cursor', 'codex', 'copilot'],
      undefined,
      false,
      undefined,
      false,
      false,
      false,
      false,
      false,
      true,
      undefined,
      undefined,
      true,
    );

    await expect(
      fs.access(path.join(tmpDir, CLAUDE_SUBAGENTS_PATH)),
    ).rejects.toThrow();
    await expect(
      fs.access(path.join(tmpDir, CURSOR_SUBAGENTS_PATH)),
    ).rejects.toThrow();
    await expect(
      fs.access(path.join(tmpDir, CODEX_SUBAGENTS_PATH)),
    ).rejects.toThrow();
    await expect(
      fs.access(path.join(tmpDir, COPILOT_SUBAGENTS_PATH)),
    ).rejects.toThrow();
  });

  it('skips non-supporting agents with a warning, still writes for supporting ones', async () => {
    await setupRulerProject(tmpDir);
    await writeSubagent(tmpDir, 'reviewer');

    await applyAllAgentConfigs(
      tmpDir,
      ['claude', 'aider'], // aider does not support native subagents
      undefined,
      false,
      undefined,
      false,
      false,
      false,
      false,
      false,
      true,
      undefined,
      undefined,
      true,
    );

    await expect(
      fs.access(path.join(tmpDir, CLAUDE_SUBAGENTS_PATH, 'reviewer.md')),
    ).resolves.toBeUndefined();
  });
});
