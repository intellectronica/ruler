import * as fs from 'fs';
import * as path from 'path';

describe('release workflow', () => {
  it('publishes only after a release is published', () => {
    const workflowPath = path.join(
      process.cwd(),
      '.github',
      'workflows',
      'release.yml',
    );
    const workflow = fs.readFileSync(workflowPath, 'utf8');

    expect(workflow).toContain('types: [published]');
    expect(workflow).not.toContain('types: [created]');
  });

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

  it('fails GitHub prereleases before publishing to npm latest', () => {
    const workflowPath = path.join(
      process.cwd(),
      '.github',
      'workflows',
      'release.yml',
    );
    const workflow = fs.readFileSync(workflowPath, 'utf8');

    const validateIndex = workflow.indexOf('- name: Validate release target');
    const publishIndex = workflow.indexOf('npm publish --access public');

    expect(workflow).toContain(
      'RELEASE_PRERELEASE: ${{ github.event.release.prerelease }}',
    );
    expect(workflow).toContain(
      'GitHub prereleases must not be published to npm latest.',
    );
    expect(validateIndex).toBeGreaterThanOrEqual(0);
    expect(publishIndex).toBeGreaterThanOrEqual(0);
    expect(validateIndex).toBeLessThan(publishIndex);
  });
});
