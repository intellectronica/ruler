import * as fs from 'fs';
import * as path from 'path';

describe('release workflow', () => {
  it('validates the release target before running npm lifecycle scripts', () => {
    const workflowPath = path.join(
      process.cwd(),
      '.github',
      'workflows',
      'release.yml',
    );
    const workflow = fs.readFileSync(workflowPath, 'utf8');

    const validateIndex = workflow.indexOf('- name: Validate release target');
    const npmCiIndex = workflow.indexOf('- run: npm ci');

    expect(validateIndex).toBeGreaterThanOrEqual(0);
    expect(npmCiIndex).toBeGreaterThanOrEqual(0);
    expect(validateIndex).toBeLessThan(npmCiIndex);
  });
});
