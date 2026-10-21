import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import * as yaml from 'js-yaml';
import { applyAllAgentConfigs } from '../../src/lib';

const OPENCODE_AGENTS_PATH = path.join('.opencode', 'agents');

describe('OpenCode subagent propagation', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ruler-opencode-agents-'),
    );
    await fs.mkdir(path.join(projectRoot, '.ruler'), { recursive: true });
    await fs.writeFile(
      path.join(projectRoot, '.ruler', 'AGENTS.md'),
      '# Rules\n',
    );
  });

  afterEach(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  /** Writes source metadata and instructions at the requested relative agent path. */
  async function writeAgent(
    relativePath: string,
    frontmatter: string,
    body = 'Do the work.\n',
  ) {
    const source = path.join(projectRoot, '.ruler', 'agents', relativePath);
    await fs.mkdir(path.dirname(source), { recursive: true });
    await fs.writeFile(source, `---\n${frontmatter}\n---\n${body}`);
  }

  /** Applies selected targets while varying subagent opt-in and dry-run behavior. */
  async function apply(
    agents = ['opencode'],
    enabled: boolean | undefined = undefined,
    dryRun = false,
  ) {
    await applyAllAgentConfigs(
      projectRoot,
      agents,
      undefined,
      false,
      undefined,
      false,
      false,
      dryRun,
      false,
      false,
      false,
      undefined,
      undefined,
      enabled,
    );
  }

  it('propagates nested agent files only to selected OpenCode targets and preserves source content', async () => {
    const original = `name: reviewer\ndescription: Review changes\nmodel: inherit\ntargets:\n  opencode:\n    model: openai/team/review\n    permission:\n      skill:\n        '*': allow\n      task:\n        '*': deny`;
    await writeAgent('review/reviewer.md', original, 'Review carefully.\n');
    await fs.mkdir(path.join(projectRoot, '.ruler', 'skills', 'checklist'), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(projectRoot, '.ruler', 'skills', 'checklist', 'SKILL.md'),
      '---\nname: checklist\ndescription: Review checklist\n---\n# Checklist\n',
    );

    await apply(['codex', 'opencode'], true);

    const output = path.join(
      projectRoot,
      OPENCODE_AGENTS_PATH,
      'review',
      'reviewer.md',
    );
    const generated = await fs.readFile(output, 'utf8');
    const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(generated);
    expect(match).not.toBeNull();
    const metadata = yaml.load(match![1]) as Record<string, any>;
    expect(metadata.name).toBeUndefined();
    expect(metadata.mode).toBe('subagent');
    expect(metadata.model).toBe('openai/team/review');
    expect(metadata.permission).toEqual({
      skill: { '*': 'allow' },
      task: { '*': 'deny' },
    });
    expect(match![2]).toBe('Review carefully.\n');
    await expect(
      fs.readFile(
        path.join(projectRoot, '.opencode', 'skills', 'checklist', 'SKILL.md'),
        'utf8',
      ),
    ).resolves.toBe(
      '---\nname: checklist\ndescription: Review checklist\n---\n# Checklist\n',
    );
    await expect(
      fs.readFile(
        path.join(projectRoot, '.ruler', 'agents', 'review', 'reviewer.md'),
        'utf8',
      ),
    ).resolves.toContain(original);
    const codexAgent = await fs.readFile(
      path.join(projectRoot, '.codex', 'agents', 'review', 'reviewer.toml'),
      'utf8',
    );
    expect(codexAgent).not.toContain('openai/team/review');
    expect(codexAgent).not.toContain('permission');
  });

  it('supports multiple provider models and omits an inherited model', async () => {
    await writeAgent(
      'one.md',
      `name: one\ndescription: One\nmodel: shared/default\ntargets:\n  opencode:\n    model: custom/provider/model`,
    );
    await writeAgent(
      'two.md',
      `name: two\ndescription: Two\nmodel: shared/default\ntargets:\n  opencode:\n    model: provider-b/reasoning`,
    );
    await writeAgent(
      'nested/three.md',
      'name: three\ndescription: Three\nmodel: inherit',
    );

    await apply(['opencode'], true);

    const one = await fs.readFile(
      path.join(projectRoot, OPENCODE_AGENTS_PATH, 'one.md'),
      'utf8',
    );
    const two = await fs.readFile(
      path.join(projectRoot, OPENCODE_AGENTS_PATH, 'two.md'),
      'utf8',
    );
    const three = await fs.readFile(
      path.join(projectRoot, OPENCODE_AGENTS_PATH, 'nested', 'three.md'),
      'utf8',
    );
    expect(
      yaml.load(one.match(/^---\n([\s\S]*?)\n---/)![1]) as any,
    ).toMatchObject({ mode: 'subagent', model: 'custom/provider/model' });
    expect(
      yaml.load(two.match(/^---\n([\s\S]*?)\n---/)![1]) as any,
    ).toMatchObject({ mode: 'subagent', model: 'provider-b/reasoning' });
    expect(
      yaml.load(three.match(/^---\n([\s\S]*?)\n---/)![1]) as any,
    ).not.toHaveProperty('model');
  });

  it('preserves a real OpenCode manifest on model errors while Codex still updates', async () => {
    await writeAgent(
      'reviewer.md',
      'name: reviewer\ndescription: Review\nmodel: shared/provider\ntargets:\n  opencode:\n    model: invalid-model',
    );
    await writeAgent('healthy.md', 'name: healthy\ndescription: Healthy agent');

    const opencodeDir = path.join(projectRoot, OPENCODE_AGENTS_PATH);
    await fs.mkdir(opencodeDir, { recursive: true });
    const oldReviewer = 'previous reviewer output\n';
    const oldStale = 'previous stale output\n';
    const oldManifest = `${JSON.stringify(
      { version: 1, paths: ['reviewer.md', 'stale.md'] },
      null,
      2,
    )}\n`;
    await fs.writeFile(path.join(opencodeDir, 'reviewer.md'), oldReviewer);
    await fs.writeFile(path.join(opencodeDir, 'stale.md'), oldStale);
    await fs.writeFile(
      path.join(opencodeDir, '.ruler-managed.json'),
      oldManifest,
    );

    await apply(['codex', 'opencode'], true);

    await expect(
      fs.readFile(path.join(opencodeDir, 'reviewer.md'), 'utf8'),
    ).resolves.toBe(oldReviewer);
    await expect(
      fs.readFile(path.join(opencodeDir, 'stale.md'), 'utf8'),
    ).resolves.toBe(oldStale);
    await expect(
      fs.readFile(path.join(opencodeDir, '.ruler-managed.json'), 'utf8'),
    ).resolves.toBe(oldManifest);
    const codexReviewer = await fs.readFile(
      path.join(projectRoot, '.codex', 'agents', 'reviewer.toml'),
      'utf8',
    );
    const codexHealthy = await fs.readFile(
      path.join(projectRoot, '.codex', 'agents', 'healthy.toml'),
      'utf8',
    );
    expect(codexReviewer).toContain('shared/provider');
    expect(codexReviewer).not.toContain('invalid-model');
    expect(codexHealthy).toContain('healthy');
  });

  it.each([
    [
      'model',
      'name: reviewer\ndescription: Review\nmodel: shared/provider\ntargets:\n  opencode:\n    model: 42',
    ],
    [
      'permission rule',
      'name: reviewer\ndescription: Review\nmodel: shared/provider\ntargets:\n  opencode:\n    permission:\n      bash: 42',
    ],
    [
      'scalar-only permission map',
      "name: reviewer\ndescription: Review\nmodel: shared/provider\ntargets:\n  opencode:\n    permission:\n      webfetch:\n        '*': allow",
    ],
    [
      'YAML timestamp permission rule',
      'name: reviewer\ndescription: Review\nmodel: shared/provider\ntargets:\n  opencode:\n    permission:\n      bash: 2026-01-01',
    ],
    [
      'empty readonly wildcard override',
      "name: reviewer\ndescription: Review\nmodel: shared/provider\nreadonly: true\ntargets:\n  opencode:\n    permission:\n      '*': {}",
    ],
    [
      'partial readonly wildcard deny',
      "name: reviewer\ndescription: Review\nmodel: shared/provider\nreadonly: true\ntargets:\n  opencode:\n    permission:\n      '*':\n        'git *': deny",
    ],
  ])(
    'keeps OpenCode managed state intact and updates Codex for malformed target %s',
    async (_kind, malformedFrontmatter) => {
      await fs.writeFile(
        path.join(projectRoot, '.ruler', 'ruler.toml'),
        '[agents]\nenabled = true\ncleanup_orphaned = true\n',
      );
      await writeAgent(
        'reviewer.md',
        'name: reviewer\ndescription: Review\nmodel: shared/provider\ntargets:\n  opencode:\n    model: openai/reviewer',
        'Initial common instructions.\n',
      );
      await writeAgent(
        'healthy.md',
        'name: healthy\ndescription: Healthy agent',
        'Healthy instructions.\n',
      );
      await apply(['codex', 'opencode'], true);

      const opencodeDir = path.join(projectRoot, OPENCODE_AGENTS_PATH);
      const managedNames = ['reviewer.md', 'healthy.md'];
      const initialOpenCodeFiles = new Map(
        await Promise.all(
          managedNames.map(
            async (name) =>
              [
                name,
                await fs.readFile(path.join(opencodeDir, name), 'utf8'),
              ] as const,
          ),
        ),
      );
      const initialManifest = await fs.readFile(
        path.join(opencodeDir, '.ruler-managed.json'),
        'utf8',
      );

      await writeAgent(
        'reviewer.md',
        malformedFrontmatter,
        'Updated common instructions.\n',
      );
      await apply(['codex', 'opencode'], true);

      await expect(
        fs.readFile(path.join(opencodeDir, '.ruler-managed.json'), 'utf8'),
      ).resolves.toBe(initialManifest);
      for (const name of managedNames) {
        await expect(
          fs.readFile(path.join(opencodeDir, name), 'utf8'),
        ).resolves.toBe(initialOpenCodeFiles.get(name));
      }
      const codexReviewer = await fs.readFile(
        path.join(projectRoot, '.codex', 'agents', 'reviewer.toml'),
        'utf8',
      );
      expect(codexReviewer).toContain('shared/provider');
      expect(codexReviewer).toContain('Updated common instructions.');
    },
  );

  it('preserves OpenCode managed state for a root built-in name while Codex generates it', async () => {
    await writeAgent(
      'reviewer.md',
      'name: reviewer\ndescription: Review',
      'Initial common instructions.\n',
    );
    await writeAgent(
      'team/build.md',
      'name: build\ndescription: Team build helper',
      'Build for the team.\n',
    );
    await apply(['codex', 'opencode'], true);

    const opencodeDir = path.join(projectRoot, OPENCODE_AGENTS_PATH);
    const managedNames = ['reviewer.md', path.join('team', 'build.md')];
    const initialOpenCodeFiles = new Map(
      await Promise.all(
        managedNames.map(
          async (name) =>
            [
              name,
              await fs.readFile(path.join(opencodeDir, name), 'utf8'),
            ] as const,
        ),
      ),
    );
    const initialManifest = await fs.readFile(
      path.join(opencodeDir, '.ruler-managed.json'),
      'utf8',
    );
    expect(JSON.parse(initialManifest).paths).toEqual([
      'reviewer.md',
      'team/build.md',
    ]);

    await writeAgent(
      'reviewer.md',
      'name: reviewer\ndescription: Review',
      'Updated common instructions.\n',
    );
    await writeAgent(
      'build.md',
      'name: build\ndescription: Root build helper',
      'Build from the root.\n',
    );
    await apply(['codex', 'opencode'], true);

    await expect(
      fs.readFile(path.join(opencodeDir, '.ruler-managed.json'), 'utf8'),
    ).resolves.toBe(initialManifest);
    for (const name of managedNames) {
      await expect(
        fs.readFile(path.join(opencodeDir, name), 'utf8'),
      ).resolves.toBe(initialOpenCodeFiles.get(name));
    }
    await expect(
      fs.access(path.join(opencodeDir, 'build.md')),
    ).rejects.toThrow();
    await expect(
      fs.readFile(
        path.join(projectRoot, '.codex', 'agents', 'reviewer.toml'),
        'utf8',
      ),
    ).resolves.toContain('Updated common instructions.');
    await expect(
      fs.readFile(
        path.join(projectRoot, '.codex', 'agents', 'build.toml'),
        'utf8',
      ),
    ).resolves.toContain('Build from the root.');
  });

  it('keeps unmanaged collisions and produces stable output on repeated apply', async () => {
    await writeAgent('managed.md', 'name: managed\ndescription: Managed');
    await writeAgent(
      'manual.md',
      'name: manual\ndescription: Source collision',
    );
    const opencodeDir = path.join(projectRoot, OPENCODE_AGENTS_PATH);
    await fs.mkdir(opencodeDir, { recursive: true });
    const manualContent = 'native OpenCode agent\n';
    await fs.writeFile(path.join(opencodeDir, 'manual.md'), manualContent);

    await apply(['opencode'], true);

    const managedPath = path.join(opencodeDir, 'managed.md');
    const firstOutput = await fs.readFile(managedPath, 'utf8');
    const firstManifest = await fs.readFile(
      path.join(opencodeDir, '.ruler-managed.json'),
      'utf8',
    );
    const parsedManifest = JSON.parse(firstManifest);
    expect(parsedManifest.paths).toEqual(['managed.md']);
    await expect(
      fs.readFile(path.join(opencodeDir, 'manual.md'), 'utf8'),
    ).resolves.toBe(manualContent);

    await apply(['opencode'], true);

    await expect(fs.readFile(managedPath, 'utf8')).resolves.toBe(firstOutput);
    await expect(
      fs.readFile(path.join(opencodeDir, '.ruler-managed.json'), 'utf8'),
    ).resolves.toBe(firstManifest);
    await expect(
      fs.readFile(path.join(opencodeDir, 'manual.md'), 'utf8'),
    ).resolves.toBe(manualContent);
  });

  it('cleans managed files only when opted in for disabled, deselected, and missing sources', async () => {
    const opencodeDir = path.join(projectRoot, OPENCODE_AGENTS_PATH);
    const manualPath = path.join(opencodeDir, 'manual.md');
    await fs.writeFile(
      path.join(projectRoot, '.ruler', 'ruler.toml'),
      '[agents]\nenabled = true\ncleanup_orphaned = false\n',
    );
    await writeAgent('owned.md', 'name: owned\ndescription: Owned');
    await apply(['opencode'], true);
    await fs.writeFile(manualPath, 'manual native agent\n');

    await fs.rm(path.join(projectRoot, '.ruler', 'agents'), {
      recursive: true,
      force: true,
    });
    await apply(['opencode'], true);
    await expect(
      fs.access(path.join(opencodeDir, 'owned.md')),
    ).resolves.toBeUndefined();

    await fs.writeFile(
      path.join(projectRoot, '.ruler', 'ruler.toml'),
      '[agents]\nenabled = true\ncleanup_orphaned = true\n',
    );
    await writeAgent('owned.md', 'name: owned\ndescription: Owned again');
    await apply(['opencode'], true);
    await fs.rm(path.join(projectRoot, '.ruler', 'agents'), {
      recursive: true,
      force: true,
    });
    await apply(['opencode'], true);
    await expect(
      fs.access(path.join(opencodeDir, 'owned.md')),
    ).rejects.toThrow();
    await expect(fs.readFile(manualPath, 'utf8')).resolves.toBe(
      'manual native agent\n',
    );

    await writeAgent('owned.md', 'name: owned\ndescription: Owned again');
    await apply(['opencode'], true);
    await apply(['opencode'], false);
    await expect(
      fs.access(path.join(opencodeDir, 'owned.md')),
    ).rejects.toThrow();
    await expect(fs.readFile(manualPath, 'utf8')).resolves.toBe(
      'manual native agent\n',
    );

    await writeAgent('owned.md', 'name: owned\ndescription: Owned again');
    await apply(['codex', 'opencode'], true);
    await apply(['codex'], true);
    await expect(
      fs.access(path.join(opencodeDir, 'owned.md')),
    ).rejects.toThrow();
    await expect(fs.readFile(manualPath, 'utf8')).resolves.toBe(
      'manual native agent\n',
    );
    await expect(
      fs.access(path.join(projectRoot, '.codex', 'agents', 'owned.toml')),
    ).resolves.toBeUndefined();
  });

  it('honors the configuration opt-in and keeps dry runs write-free', async () => {
    await writeAgent('reviewer.md', 'name: reviewer\ndescription: Review');
    await apply(['opencode'], undefined);
    await expect(
      fs.access(path.join(projectRoot, OPENCODE_AGENTS_PATH)),
    ).rejects.toThrow();

    await fs.writeFile(
      path.join(projectRoot, '.ruler', 'ruler.toml'),
      '[agents]\nenabled = true\n',
    );
    await apply(['opencode'], undefined, true);
    await expect(
      fs.access(path.join(projectRoot, OPENCODE_AGENTS_PATH)),
    ).rejects.toThrow();
    await apply(['opencode'], true);
    await expect(
      fs.access(path.join(projectRoot, OPENCODE_AGENTS_PATH, 'reviewer.md')),
    ).resolves.toBeUndefined();
  });
});
