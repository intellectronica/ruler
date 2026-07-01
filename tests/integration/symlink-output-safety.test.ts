import * as fs from 'fs/promises';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { setupTestProject, teardownTestProject } from '../harness';

describe('Symlink output safety', () => {
  let projectRoot: string;
  let outsideFile: string;

  beforeEach(async () => {
    const project = await setupTestProject({
      '.ruler/AGENTS.md': 'Ruler rules',
    });
    projectRoot = project.projectRoot;
    outsideFile = path.join(
      projectRoot,
      '..',
      `${path.basename(projectRoot)}-outside.md`,
    );
    await fs.writeFile(outsideFile, 'outside original');
  });

  afterEach(async () => {
    await teardownTestProject(projectRoot);
    await fs.rm(outsideFile, { force: true });
  });

  it('does not overwrite a root AGENTS.md symlink target outside the project', async () => {
    await fs.symlink(outsideFile, path.join(projectRoot, 'AGENTS.md'));

    expect(() =>
      execFileSync(
        'node',
        [
          path.resolve('dist/cli/index.js'),
          'apply',
          '--project-root',
          projectRoot,
          '--agents',
          'agentsmd',
          '--no-backup',
          '--no-gitignore',
        ],
        {
          stdio: 'pipe',
        },
      ),
    ).toThrow();

    await expect(fs.readFile(outsideFile, 'utf8')).resolves.toBe(
      'outside original',
    );
  });

  it('does not overwrite a hard-linked output target outside the project', async () => {
    const outputPath = path.join(projectRoot, 'AGENTS.md');
    await fs.link(outsideFile, outputPath);

    expect(() =>
      execFileSync(
        'node',
        [
          path.resolve('dist/cli/index.js'),
          'apply',
          '--project-root',
          projectRoot,
          '--agents',
          'agentsmd',
          '--no-backup',
          '--no-gitignore',
        ],
        {
          stdio: 'pipe',
        },
      ),
    ).toThrow();

    await expect(fs.readFile(outsideFile, 'utf8')).resolves.toBe(
      'outside original',
    );
  });

  it('does not overwrite an MCP config symlink target outside the project', async () => {
    await fs.writeFile(
      path.join(projectRoot, '.ruler', 'ruler.toml'),
      [
        '[mcp_servers.filesystem]',
        'command = "node"',
        'args = ["server.js"]',
        '',
      ].join('\n'),
    );
    await fs.mkdir(path.join(projectRoot, '.cursor'), { recursive: true });
    await fs.symlink(
      outsideFile,
      path.join(projectRoot, '.cursor', 'mcp.json'),
    );

    expect(() =>
      execFileSync(
        'node',
        [
          path.resolve('dist/cli/index.js'),
          'apply',
          '--project-root',
          projectRoot,
          '--agents',
          'cursor',
          '--no-backup',
          '--no-gitignore',
        ],
        {
          stdio: 'pipe',
        },
      ),
    ).toThrow();

    await expect(fs.readFile(outsideFile, 'utf8')).resolves.toBe(
      'outside original',
    );
  });

  it('does not write through an MCP config directory symlink outside the project', async () => {
    const outsideDir = path.join(
      projectRoot,
      '..',
      `${path.basename(projectRoot)}-outside-dir`,
    );
    await fs.mkdir(outsideDir);
    await fs.writeFile(
      path.join(projectRoot, '.ruler', 'ruler.toml'),
      [
        '[mcp_servers.filesystem]',
        'command = "node"',
        'args = ["server.js"]',
        '',
      ].join('\n'),
    );
    await fs.symlink(outsideDir, path.join(projectRoot, '.cursor'));

    try {
      expect(() =>
        execFileSync(
          'node',
          [
            path.resolve('dist/cli/index.js'),
            'apply',
            '--project-root',
            projectRoot,
            '--agents',
            'cursor',
            '--no-backup',
            '--no-gitignore',
          ],
          {
            stdio: 'pipe',
          },
        ),
      ).toThrow();

      await expect(
        fs.access(path.join(outsideDir, 'mcp.json')),
      ).rejects.toThrow();
    } finally {
      await fs.rm(outsideDir, { recursive: true, force: true });
    }
  });

  it('does not write agent output through a symlinked parent directory outside the project', async () => {
    const outsideDir = path.join(
      projectRoot,
      '..',
      `${path.basename(projectRoot)}-outside-agent-dir`,
    );
    await fs.mkdir(outsideDir);
    await fs.symlink(outsideDir, path.join(projectRoot, 'linked'));
    await fs.writeFile(
      path.join(projectRoot, '.ruler', 'ruler.toml'),
      ['[agents.claude]', 'output_path = "linked/CLAUDE.md"', ''].join('\n'),
    );

    try {
      expect(() =>
        execFileSync(
          'node',
          [
            path.resolve('dist/cli/index.js'),
            'apply',
            '--project-root',
            projectRoot,
            '--agents',
            'claude',
            '--no-backup',
            '--no-gitignore',
          ],
          {
            stdio: 'pipe',
          },
        ),
      ).toThrow();

      await expect(
        fs.access(path.join(outsideDir, 'CLAUDE.md')),
      ).rejects.toThrow();
    } finally {
      await fs.rm(outsideDir, { recursive: true, force: true });
    }
  });

  it('does not create directories through a symlinked parent before failing', async () => {
    const outsideDir = path.join(
      projectRoot,
      '..',
      `${path.basename(projectRoot)}-outside-parent-dir`,
    );
    await fs.mkdir(outsideDir);
    await fs.symlink(outsideDir, path.join(projectRoot, 'linked'));
    await fs.writeFile(
      path.join(projectRoot, '.ruler', 'ruler.toml'),
      ['[agents.opencode]', 'output_path = "linked/newdir/AGENTS.md"', ''].join(
        '\n',
      ),
    );

    try {
      expect(() =>
        execFileSync(
          'node',
          [
            path.resolve('dist/cli/index.js'),
            'apply',
            '--project-root',
            projectRoot,
            '--agents',
            'opencode',
            '--no-backup',
            '--no-gitignore',
          ],
          {
            stdio: 'pipe',
          },
        ),
      ).toThrow();

      await expect(
        fs.access(path.join(outsideDir, 'newdir')),
      ).rejects.toThrow();
    } finally {
      await fs.rm(outsideDir, { recursive: true, force: true });
    }
  });

  it('does not write MCP config through a symlinked file outside the project', async () => {
    const outsideDir = path.join(
      projectRoot,
      '..',
      `${path.basename(projectRoot)}-outside-mcp-dir`,
    );
    await fs.mkdir(outsideDir);
    await fs.writeFile(path.join(outsideDir, 'mcp.json'), '{"existing":true}');
    await fs.writeFile(
      path.join(projectRoot, '.ruler', 'ruler.toml'),
      [
        '[mcp_servers.filesystem]',
        'command = "node"',
        'args = ["server.js"]',
        '',
      ].join('\n'),
    );
    // Symlink .mcp.json directly to a file outside the project
    await fs.symlink(
      path.join(outsideDir, 'mcp.json'),
      path.join(projectRoot, '.mcp.json'),
    );

    try {
      expect(() =>
        execFileSync(
          'node',
          [
            path.resolve('dist/cli/index.js'),
            'apply',
            '--project-root',
            projectRoot,
            '--agents',
            'copilot',
            '--no-gitignore',
          ],
          {
            stdio: 'pipe',
          },
        ),
      ).toThrow();

      await expect(
        fs.readFile(path.join(outsideDir, 'mcp.json'), 'utf8'),
      ).resolves.toBe('{"existing":true}');
      await expect(
        fs.access(path.join(outsideDir, 'mcp.json.bak')),
      ).rejects.toThrow();
    } finally {
      await fs.rm(path.join(projectRoot, '.mcp.json'), { force: true });
      await fs.rm(outsideDir, { recursive: true, force: true });
    }
  });

  it('does not restore a backup through a symlinked output file outside the project', async () => {
    const outputPath = path.join(projectRoot, 'CLAUDE.md');
    await fs.symlink(outsideFile, outputPath);
    await fs.writeFile(`${outputPath}.bak`, 'backup content');

    expect(() =>
      execFileSync(
        'node',
        [
          path.resolve('dist/cli/index.js'),
          'revert',
          '--project-root',
          projectRoot,
          '--agents',
          'claude',
        ],
        {
          stdio: 'pipe',
        },
      ),
    ).toThrow();

    await expect(fs.readFile(outsideFile, 'utf8')).resolves.toBe(
      'outside original',
    );
    await expect(fs.readFile(`${outputPath}.bak`, 'utf8')).resolves.toBe(
      'backup content',
    );
  });

  it('does not restore a backup through a symlinked output file inside the project', async () => {
    const outputPath = path.join(projectRoot, 'CLAUDE.md');
    const victimPath = path.join(projectRoot, 'victim.md');
    await fs.writeFile(victimPath, 'victim original');
    await fs.symlink(victimPath, outputPath);
    await fs.writeFile(`${outputPath}.bak`, 'backup content');

    expect(() =>
      execFileSync(
        'node',
        [
          path.resolve('dist/cli/index.js'),
          'revert',
          '--project-root',
          projectRoot,
          '--agents',
          'claude',
        ],
        {
          stdio: 'pipe',
        },
      ),
    ).toThrow();

    await expect(fs.readFile(victimPath, 'utf8')).resolves.toBe(
      'victim original',
    );
    await expect(fs.readFile(`${outputPath}.bak`, 'utf8')).resolves.toBe(
      'backup content',
    );
  });

  it('does not clean a managed ignore file through a symlink', async () => {
    await fs.writeFile(
      outsideFile,
      [
        'outside original',
        '# START Ruler Generated Files',
        '/CLAUDE.md',
        '# END Ruler Generated Files',
        '',
      ].join('\n'),
    );
    await fs.symlink(outsideFile, path.join(projectRoot, '.gitignore'));

    expect(() =>
      execFileSync(
        'node',
        [
          path.resolve('dist/cli/index.js'),
          'revert',
          '--project-root',
          projectRoot,
        ],
        {
          stdio: 'pipe',
        },
      ),
    ).toThrow();

    await expect(fs.readFile(outsideFile, 'utf8')).resolves.toBe(
      [
        'outside original',
        '# START Ruler Generated Files',
        '/CLAUDE.md',
        '# END Ruler Generated Files',
        '',
      ].join('\n'),
    );
  });
});
