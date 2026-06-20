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
});
