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
});
