import { execFileSync } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

describe('packaged CLI version', () => {
  let tmpDir: string;
  let npmUserConfigPath: string;
  let tarballPath: string | undefined;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-version-'));
    npmUserConfigPath = path.join(tmpDir, 'empty-npmrc');
    await fs.writeFile(npmUserConfigPath, '');
  });

  afterEach(async () => {
    if (tarballPath) {
      await fs.rm(tarballPath, { force: true });
      tarballPath = undefined;
    }
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('reports the package version from a packed install', async () => {
    const originalAllowScripts = process.env.npm_config_allow_scripts;

    try {
      process.env.npm_config_allow_scripts = 'better-sqlite3';

      const packageJson = JSON.parse(
        execFileSync(
          'node',
          ['-p', "JSON.stringify(require('./package.json'))"],
          {
            encoding: 'utf8',
          },
        ),
      ) as { version: string };

      const npmEnv = createIsolatedNpmEnv(npmUserConfigPath);
      const packageRoot = await createCleanPackageRoot(tmpDir);
      const tarballName = execFileSync(
        'npm',
        ['pack', '--silent', '--pack-destination', tmpDir],
        {
          encoding: 'utf8',
          cwd: packageRoot,
          env: npmEnv,
        },
      ).trim();
      tarballPath = path.join(tmpDir, tarballName);
      const extractedDir = path.join(tmpDir, 'extracted');
      await fs.mkdir(extractedDir);
      execFileSync('tar', ['-xzf', tarballPath, '-C', extractedDir]);

      execFileSync('npm', ['install', '--prefix', tmpDir, tarballPath], {
        stdio: 'pipe',
        env: npmEnv,
      });

      const output = execFileSync(
        path.join(tmpDir, 'node_modules', '.bin', 'ruler'),
        ['--version'],
        { encoding: 'utf8' },
      ).trim();

      expect(output).toBe(packageJson.version);

      const extractedCliPath = path.join(
        extractedDir,
        'package',
        'dist',
        'cli',
        'index.js',
      );
      const extractedCliStat = await fs.stat(extractedCliPath);
      expect(extractedCliStat.mode & 0o111).not.toBe(0);
      expect(
        execFileSync(extractedCliPath, ['--version'], {
          encoding: 'utf8',
        }).trim(),
      ).toBe(packageJson.version);
    } finally {
      if (originalAllowScripts === undefined) {
        delete process.env.npm_config_allow_scripts;
      } else {
        process.env.npm_config_allow_scripts = originalAllowScripts;
      }
    }
  });
});

function createIsolatedNpmEnv(userConfigPath: string): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (
      key.toLowerCase() === 'npm_config_allow_scripts' ||
      key.toLowerCase() === 'npm_config_userconfig'
    ) {
      delete env[key];
    }
  }
  env.npm_config_userconfig = userConfigPath;
  return env;
}

async function createCleanPackageRoot(tmpDir: string): Promise<string> {
  const packageRoot = path.join(tmpDir, 'package-root');
  await fs.mkdir(packageRoot);

  const trackedFiles = execFileSync('git', ['ls-files', '-z'], {
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean)
    .filter((filePath) => !filePath.startsWith('dist/'));

  await Promise.all(
    trackedFiles.map(async (filePath) => {
      const sourcePath = path.join(process.cwd(), filePath);
      const destinationPath = path.join(packageRoot, filePath);
      await fs.mkdir(path.dirname(destinationPath), { recursive: true });
      await fs.copyFile(sourcePath, destinationPath);
    }),
  );

  await fs.symlink(
    path.join(process.cwd(), 'node_modules'),
    path.join(packageRoot, 'node_modules'),
    'dir',
  );

  return packageRoot;
}
