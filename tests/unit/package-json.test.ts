import * as fs from 'fs';
import * as path from 'path';

describe('package manifest', () => {
  it('does not run builds during install-time lifecycle hooks', () => {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(
      fs.readFileSync(packageJsonPath, 'utf8'),
    ) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.prepare).toBeUndefined();
    expect(packageJson.scripts?.prepublishOnly).toBe('npm run build');
  });

  it('cleans stale dist output before building publish artifacts', () => {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(
      fs.readFileSync(packageJsonPath, 'utf8'),
    ) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.clean).toContain("rmSync('dist'");
    expect(packageJson.scripts?.clean).toContain('recursive: true');
    expect(packageJson.scripts?.clean).toContain('force: true');
    expect(packageJson.scripts?.build).toBe('npm run clean && tsc');
    expect(packageJson.scripts?.prepublishOnly).toBe('npm run build');
  });

  it('formats top-level JavaScript configuration files', () => {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(
      fs.readFileSync(packageJsonPath, 'utf8'),
    ) as {
      scripts?: Record<string, string>;
    };

    const expectedPaths = [
      '.prettierrc.js',
      'eslint.config.mjs',
      'jest.config.js',
      'jest.setup.js',
    ];

    for (const scriptName of ['format', 'format:check']) {
      const script = packageJson.scripts?.[scriptName] ?? '';
      for (const expectedPath of expectedPaths) {
        expect(script).toContain(expectedPath);
      }
    }
  });

  it('runs the intended integration and e2e test roots', () => {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(
      fs.readFileSync(packageJsonPath, 'utf8'),
    ) as {
      scripts?: Record<string, string>;
    };

    const script = packageJson.scripts?.['test:integration'] ?? '';
    expect(script).toContain('tests/e2e');
    expect(script).toContain('tests/integration');
    expect(script).not.toContain('ruler.integration.test.ts');
  });
});
