import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { OpenCodeAgent } from '../../../src/agents/OpenCodeAgent';
import {
  getSelectedSubagentTargets,
  getSubagentsGitignorePaths,
  propagateSubagents,
} from '../../../src/core/SubagentsProcessor';

describe('OpenCode subagent routing', () => {
  let root: string;
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-opencode-routing-'));
    await fs.mkdir(path.join(root, '.ruler/agents'), { recursive: true });
    await fs.writeFile(
      path.join(root, '.ruler/agents/reviewer.md'),
      '---\nname: reviewer\ndescription: Reviews code\n---\nReview the diff.\n',
    );
  });
  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('selects OpenCode only when its adapter is selected', () => {
    expect(getSelectedSubagentTargets([new OpenCodeAgent()])).toEqual(
      new Set(['opencode']),
    );
    expect(getSelectedSubagentTargets([])).toEqual(new Set());
  });

  it.each([
    'build',
    'plan',
    'general',
    'explore',
    'compaction',
    'title',
    'summary',
  ])(
    'rejects the built-in name %s before writing any OpenCode agent',
    async (name) => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      await fs.writeFile(
        path.join(root, `.ruler/agents/${name}.md`),
        `---\nname: ${name}\ndescription: Custom instructions\n---\nCustom body.\n`,
      );

      await propagateSubagents(
        root,
        [new OpenCodeAgent()],
        true,
        false,
        false,
        false,
      );

      expect(warn.mock.calls.flat().join('\n')).toMatch(
        /reserved.*OpenCode|OpenCode.*reserved/i,
      );
      await expect(
        fs.access(path.join(root, '.opencode/agents')),
      ).rejects.toThrow();
    },
  );

  it('allows a nested agent whose basename matches a built-in', async () => {
    await fs.mkdir(path.join(root, '.ruler/agents/team'), { recursive: true });
    await fs.writeFile(
      path.join(root, '.ruler/agents/team/build.md'),
      '---\nname: build\ndescription: Team build helper\n---\nBuild for the team.\n',
    );

    await propagateSubagents(
      root,
      [new OpenCodeAgent()],
      true,
      false,
      false,
      false,
    );

    await expect(
      fs.readFile(path.join(root, '.opencode/agents/team/build.md'), 'utf8'),
    ).resolves.toContain('mode: subagent');
  });

  it('includes individual generated files and the manifest in gitignore paths', async () => {
    expect(
      await getSubagentsGitignorePaths(root, [new OpenCodeAgent()]),
    ).toEqual([
      path.join(root, '.opencode/agents/.ruler-managed.json'),
      path.join(root, '.opencode/agents/reviewer.md'),
    ]);
  });

  it('previews the file path in orchestrated dry runs without creating output', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    await propagateSubagents(
      root,
      [new OpenCodeAgent()],
      true,
      false,
      false,
      true,
    );
    expect(log.mock.calls.flat().join('\n')).toContain(
      '.opencode/agents/reviewer.md',
    );
    await expect(fs.access(path.join(root, '.opencode'))).rejects.toThrow();
  });
});
