import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execFileSync, spawnSync } from 'child_process';
import * as yaml from 'js-yaml';

describe('OpenCode subagents CLI', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ruler-e2e-opencode-agents-'),
    );
    await fs.mkdir(path.join(projectRoot, '.ruler', 'agents'), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(projectRoot, '.ruler', 'AGENTS.md'),
      '# Rules\n',
    );
  });

  afterEach(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  /** Creates a source agent fixture, including any nested source directories. */
  async function writeAgent(file: string, fm: string, body = 'Agent body.\n') {
    const fullPath = path.join(projectRoot, '.ruler', 'agents', file);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, `---\n${fm}\n---\n${body}`);
  }

  /** Runs the built CLI for OpenCode and throws if generation exits unsuccessfully. */
  function run(...extraArgs: string[]): string {
    return execFileSync(
      process.execPath,
      [
        path.resolve('dist/cli/index.js'),
        'apply',
        '--project-root',
        projectRoot,
        '--agents',
        'opencode',
        '--no-mcp',
        ...extraArgs,
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
  }

  /** Captures CLI output and exit status so warnings and failures can be asserted. */
  function runWithDiagnostics(...extraArgs: string[]) {
    return spawnSync(
      process.execPath,
      [
        path.resolve('dist/cli/index.js'),
        'apply',
        '--project-root',
        projectRoot,
        '--agents',
        'opencode',
        '--no-mcp',
        ...extraArgs,
      ],
      { encoding: 'utf8' },
    );
  }

  it('defaults to disabled, allows TOML opt-in, and gives the CLI flag priority', async () => {
    await writeAgent(
      'reviewer.md',
      'name: reviewer\ndescription: Reviews code',
    );
    run();
    const outputDir = path.join(projectRoot, '.opencode', 'agents');
    await expect(fs.access(outputDir)).rejects.toThrow();

    await fs.writeFile(
      path.join(projectRoot, '.ruler', 'ruler.toml'),
      '[agents]\nenabled = true\n',
    );
    run();
    await expect(
      fs.access(path.join(outputDir, 'reviewer.md')),
    ).resolves.toBeUndefined();

    await fs.rm(outputDir, { recursive: true, force: true });
    run('--no-subagents');
    await expect(fs.access(outputDir)).rejects.toThrow();
    run('--subagents');
    await expect(
      fs.access(path.join(outputDir, 'reviewer.md')),
    ).resolves.toBeUndefined();
  });

  it('writes target-specific OpenCode metadata, nested files, and managed ignore entries', async () => {
    await writeAgent(
      'review/auditor.md',
      `name: auditor\ndescription: Audit\nmodel: inherit\ntargets:\n  opencode:\n    model: vendor-x/team/audit\n    mode: subagent\n    permission:\n      skill:\n        '*': allow\n      task:\n        '*': deny`,
      'Audit the repository.\n',
    );
    await writeAgent(
      'researcher.md',
      `name: researcher\ndescription: Research\nmodel: provider-y/research`,
    );

    run('--subagents');

    const agentDir = path.join(projectRoot, '.opencode', 'agents');
    const auditorPath = path.join(agentDir, 'review', 'auditor.md');
    const auditorText = await fs.readFile(auditorPath, 'utf8');
    const auditorMatch = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(auditorText)!;
    const auditor = yaml.load(auditorMatch[1]) as Record<string, any>;
    expect(auditor).toMatchObject({
      mode: 'subagent',
      model: 'vendor-x/team/audit',
    });
    expect(auditor.name).toBeUndefined();
    expect(auditor.permission).toEqual({
      skill: { '*': 'allow' },
      task: { '*': 'deny' },
    });
    expect(auditorMatch[2]).toBe('Audit the repository.\n');

    const researcherText = await fs.readFile(
      path.join(agentDir, 'researcher.md'),
      'utf8',
    );
    const researcher = yaml.load(
      researcherText.match(/^---\n([\s\S]*?)\n---/)![1],
    ) as any;
    expect(researcher.model).toBe('provider-y/research');
    const gitignore = await fs.readFile(
      path.join(projectRoot, '.gitignore'),
      'utf8',
    );
    expect(gitignore).toContain('/.opencode/agents/review/auditor.md');
    expect(gitignore).toContain('/.opencode/agents/.ruler-managed.json');
    const manifest = JSON.parse(
      await fs.readFile(path.join(agentDir, '.ruler-managed.json'), 'utf8'),
    );
    expect(manifest.paths).toEqual(
      expect.arrayContaining(['review/auditor.md', 'researcher.md']),
    );
  });

  it.each([
    [
      'model',
      'reviewer',
      'targets:\n  opencode:\n    model: not-a-model',
      /model/i,
    ],
    [
      'empty readonly override',
      'reviewer',
      "readonly: true\ntargets:\n  opencode:\n    permission:\n      '*': {}",
      /readonly/i,
    ],
    [
      'partial readonly override',
      'reviewer',
      "readonly: true\ntargets:\n  opencode:\n    permission:\n      '*':\n        'protected/*': deny",
      /readonly/i,
    ],
    [
      'scalar-only permission',
      'reviewer',
      "targets:\n  opencode:\n    permission:\n      webfetch:\n        '*': allow",
      /permission.webfetch/i,
    ],
    [
      'YAML date permission',
      'reviewer',
      'targets:\n  opencode:\n    permission:\n      bash: 2026-01-01',
      /permission.bash/i,
    ],
    ['built-in name', 'build', '', /reserved OpenCode/i],
  ])(
    'preserves managed outputs and diagnoses invalid %s',
    async (_kind, name, fields, diagnostic) => {
      await writeAgent(
        `${name}.md`,
        `name: ${name}\ndescription: Reviews\n${fields}`,
      );
      const agentDir = path.join(projectRoot, '.opencode', 'agents');
      await fs.mkdir(agentDir, { recursive: true });
      const previous = 'previous generated output\n';
      await fs.writeFile(path.join(agentDir, 'reviewer.md'), previous);
      const manifest = JSON.stringify({ version: 1, paths: ['reviewer.md'] });
      await fs.writeFile(path.join(agentDir, '.ruler-managed.json'), manifest);

      const result = runWithDiagnostics('--subagents');
      expect(result.status).toBe(0);

      await expect(
        fs.readFile(path.join(agentDir, 'reviewer.md'), 'utf8'),
      ).resolves.toBe(previous);
      await expect(
        fs.readFile(path.join(agentDir, '.ruler-managed.json'), 'utf8'),
      ).resolves.toBe(manifest);
      await expect(fs.readdir(agentDir)).resolves.toEqual([
        '.ruler-managed.json',
        'reviewer.md',
      ]);
      expect(`${result.stdout}\n${result.stderr}`).toMatch(
        diagnostic as RegExp,
      );
    },
  );

  it('warns about nested skill collisions and still copies the source tree', async () => {
    const definitions = [
      ['.ruler/skills/outer', 'outer', 'Outer source'],
      ['.ruler/skills/outer/inner', 'inner', 'Inner source'],
      ['.claude/skills/native', 'native', 'Native parent'],
      ['.claude/skills/native/inner', 'inner', 'Divergent native instructions'],
    ];
    for (const [directory, name, body] of definitions) {
      const fullPath = path.join(projectRoot, directory);
      await fs.mkdir(fullPath, { recursive: true });
      await fs.writeFile(
        path.join(fullPath, 'SKILL.md'),
        `---\nname: ${name}\ndescription: Skill instructions\n---\n${body}\n`,
      );
    }

    const result = runWithDiagnostics();

    expect(result.status).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      '.claude/skills/native/inner defines "inner" with contents that differ',
    );
    await expect(
      fs.readFile(
        path.join(projectRoot, '.opencode/skills/outer/inner/SKILL.md'),
        'utf8',
      ),
    ).resolves.toContain('Inner source');
    await expect(
      fs.readFile(
        path.join(projectRoot, '.claude/skills/native/inner/SKILL.md'),
        'utf8',
      ),
    ).resolves.toContain('Divergent native instructions');
  });

  it('does not follow a symlinked OpenCode agents directory', async () => {
    await writeAgent('reviewer.md', 'name: reviewer\ndescription: Reviews');
    const outside = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ruler-opencode-outside-'),
    );
    try {
      await fs.mkdir(path.join(projectRoot, '.opencode'), { recursive: true });
      await fs.symlink(outside, path.join(projectRoot, '.opencode', 'agents'));

      const result = runWithDiagnostics('--subagents');

      expect(result.status).not.toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toMatch(
        /symlink|inside root/i,
      );
      await expect(fs.readdir(outside)).resolves.toEqual([]);
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });
});
