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

  it('reports the package version from a packed install', () => {
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
      const tarballName = execFileSync('npm', ['pack', '--silent'], {
        encoding: 'utf8',
        env: npmEnv,
      }).trim();
      tarballPath = path.join(process.cwd(), tarballName);

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
