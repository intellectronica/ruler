import { execFileSync } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

describe('packaged CLI version', () => {
  let tmpDir: string;
  let tarballPath: string | undefined;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-version-'));
  });

  afterEach(async () => {
    if (tarballPath) {
      await fs.rm(tarballPath, { force: true });
      tarballPath = undefined;
    }
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('reports the package version from a packed install', () => {
    const packageJson = JSON.parse(
      execFileSync(
        'node',
        ['-p', "JSON.stringify(require('./package.json'))"],
        {
          encoding: 'utf8',
        },
      ),
    ) as { version: string };

    const tarballName = execFileSync('npm', ['pack', '--silent'], {
      encoding: 'utf8',
    }).trim();
    tarballPath = path.join(process.cwd(), tarballName);

    execFileSync('npm', ['install', '--prefix', tmpDir, tarballPath], {
      stdio: 'pipe',
    });

    const output = execFileSync(
      path.join(tmpDir, 'node_modules', '.bin', 'ruler'),
      ['--version'],
      { encoding: 'utf8' },
    ).trim();

    expect(output).toBe(packageJson.version);
  });
});
