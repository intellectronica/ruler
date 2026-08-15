import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import {
  setupTestProject,
  teardownTestProject,
  runRulerWithInheritedStdio,
} from '../harness';

describe('CLI nested toggle precedence', () => {
  let projectRoot: string;

  async function writeNestedProjectConfig(options: {
    nestedTomlValue: boolean;
    includeSubmodule?: boolean;
  }): Promise<void> {
    const { nestedTomlValue, includeSubmodule = true } = options;

    const rootRulerDir = path.join(projectRoot, '.ruler');
    await fs.mkdir(rootRulerDir, { recursive: true });
    await fs.writeFile(
      path.join(rootRulerDir, 'AGENTS.md'),
      '# Root Rules\n\nThese apply at the root.',
    );
    await fs.writeFile(
      path.join(rootRulerDir, 'ruler.toml'),
      `nested = ${nestedTomlValue}`,
    );

    if (includeSubmodule) {
      const moduleDir = path.join(projectRoot, 'module');
      await fs.mkdir(path.join(moduleDir, '.ruler'), { recursive: true });
      await fs.writeFile(
        path.join(moduleDir, '.ruler', 'AGENTS.md'),
        '# Module Rules\n\nThese apply inside module.',
      );
    }
  }

  beforeEach(async () => {
    const testProject = await setupTestProject();
    projectRoot = testProject.projectRoot;
  });

  afterEach(async () => {
    await teardownTestProject(projectRoot);
  });

  it('activates nested processing when config sets nested = true', async () => {
    await writeNestedProjectConfig({ nestedTomlValue: true });

    runRulerWithInheritedStdio('apply --agents claude', projectRoot);

    await expect(
      fs.readFile(path.join(projectRoot, 'module', 'CLAUDE.md'), 'utf8'),
    ).resolves.toContain('Module Rules');
  });

  it('remains flat when config sets nested = false and CLI omits --nested', async () => {
    await writeNestedProjectConfig({ nestedTomlValue: false });

    runRulerWithInheritedStdio('apply --agents claude', projectRoot);

    await expect(
      fs.stat(path.join(projectRoot, 'module', 'CLAUDE.md')),
    ).rejects.toThrow();
  });

  it('prefers CLI --nested over a config that sets nested = false', async () => {
    await writeNestedProjectConfig({ nestedTomlValue: false });

    runRulerWithInheritedStdio('apply --agents claude --nested', projectRoot);

    await expect(
      fs.readFile(path.join(projectRoot, 'module', 'CLAUDE.md'), 'utf8'),
    ).resolves.toContain('Module Rules');
  });

  it('respects child default_agents when applying nested configs', async () => {
    const rootRulerDir = path.join(projectRoot, '.ruler');
    const moduleDir = path.join(projectRoot, 'module');
    const moduleRulerDir = path.join(moduleDir, '.ruler');

    await fs.mkdir(rootRulerDir, { recursive: true });
    await fs.mkdir(moduleRulerDir, { recursive: true });
    await fs.writeFile(
      path.join(rootRulerDir, 'AGENTS.md'),
      '# Root Rules\n\nThese apply at the root.',
    );
    await fs.writeFile(
      path.join(rootRulerDir, 'ruler.toml'),
      'default_agents = ["claude"]\nnested = true\n',
    );
    await fs.writeFile(
      path.join(moduleRulerDir, 'AGENTS.md'),
      '# Module Rules\n\nThese apply inside module.',
    );
    await fs.writeFile(
      path.join(moduleRulerDir, 'ruler.toml'),
      'default_agents = ["windsurf"]\n',
    );

    runRulerWithInheritedStdio('apply', projectRoot);

    await expect(
      fs.readFile(path.join(projectRoot, 'CLAUDE.md'), 'utf8'),
    ).resolves.toContain('Root Rules');
    await expect(
      fs.stat(path.join(projectRoot, 'AGENTS.md')),
    ).rejects.toThrow();
    await expect(
      fs.readFile(path.join(moduleDir, 'AGENTS.md'), 'utf8'),
    ).resolves.toContain('Module Rules');
    await expect(fs.stat(path.join(moduleDir, 'CLAUDE.md'))).rejects.toThrow();
  });

  it('lets CLI --agents override child default_agents in nested configs', async () => {
    const rootRulerDir = path.join(projectRoot, '.ruler');
    const moduleDir = path.join(projectRoot, 'module');
    const moduleRulerDir = path.join(moduleDir, '.ruler');

    await fs.mkdir(rootRulerDir, { recursive: true });
    await fs.mkdir(moduleRulerDir, { recursive: true });
    await fs.writeFile(
      path.join(rootRulerDir, 'AGENTS.md'),
      '# Root Rules\n\nThese apply at the root.',
    );
    await fs.writeFile(
      path.join(rootRulerDir, 'ruler.toml'),
      'default_agents = ["claude"]\nnested = true\n',
    );
    await fs.writeFile(
      path.join(moduleRulerDir, 'AGENTS.md'),
      '# Module Rules\n\nThese apply inside module.',
    );
    await fs.writeFile(
      path.join(moduleRulerDir, 'ruler.toml'),
      'default_agents = ["windsurf"]\n',
    );

    runRulerWithInheritedStdio('apply --agents claude', projectRoot);

    await expect(
      fs.readFile(path.join(moduleDir, 'CLAUDE.md'), 'utf8'),
    ).resolves.toContain('Module Rules');
    await expect(fs.stat(path.join(moduleDir, 'AGENTS.md'))).rejects.toThrow();
  });

  it('does not apply nested configs inside a linked worktree', async () => {
    const parentDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ruler-nested-linked-worktree-'),
    );
    const sourceDir = path.join(parentDir, 'source');
    const rootDir = path.join(parentDir, 'root');
    const linkedWorktreeDir = path.join(rootDir, 'linked');

    try {
      execFileSync('git', ['init', sourceDir], { stdio: 'pipe' });
      execFileSync(
        'git',
        ['-C', sourceDir, 'config', 'user.email', 'test@example.com'],
        { stdio: 'pipe' },
      );
      execFileSync('git', ['-C', sourceDir, 'config', 'user.name', 'Test'], {
        stdio: 'pipe',
      });

      await fs.mkdir(path.join(sourceDir, '.ruler'), { recursive: true });
      await fs.writeFile(
        path.join(sourceDir, '.ruler', 'AGENTS.md'),
        '# Child Rules',
      );
      await fs.writeFile(
        path.join(sourceDir, 'CLAUDE.md'),
        '# Existing Child Output',
      );
      execFileSync(
        'git',
        ['-C', sourceDir, 'add', '.ruler/AGENTS.md', 'CLAUDE.md'],
        {
          stdio: 'pipe',
        },
      );
      execFileSync('git', ['-C', sourceDir, 'commit', '-m', 'init'], {
        stdio: 'pipe',
      });

      await fs.mkdir(path.join(rootDir, '.ruler'), { recursive: true });
      await fs.writeFile(
        path.join(rootDir, '.ruler', 'AGENTS.md'),
        '# Root Rules',
      );
      execFileSync(
        'git',
        [
          '-C',
          sourceDir,
          'worktree',
          'add',
          '--detach',
          linkedWorktreeDir,
          'HEAD',
        ],
        { stdio: 'pipe' },
      );

      const linkedGitStat = await fs.stat(path.join(linkedWorktreeDir, '.git'));
      expect(linkedGitStat.isFile()).toBe(true);

      runRulerWithInheritedStdio(
        'apply --agents claude --nested --local-only --no-mcp --no-gitignore --no-backup',
        rootDir,
      );

      await expect(
        fs.readFile(path.join(rootDir, 'CLAUDE.md'), 'utf8'),
      ).resolves.toContain('Root Rules');
      await expect(
        fs.readFile(path.join(linkedWorktreeDir, 'CLAUDE.md'), 'utf8'),
      ).resolves.toBe('# Existing Child Output');
    } finally {
      await fs.rm(parentDir, { recursive: true, force: true });
    }
  });
});
