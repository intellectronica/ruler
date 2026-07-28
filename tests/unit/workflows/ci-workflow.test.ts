import * as fs from 'fs';
import * as path from 'path';

describe('CI workflow', () => {
  it('audits production dependencies without blocking on dev toolchain advisories', () => {
    const workflowPath = path.join(
      process.cwd(),
      '.github',
      'workflows',
      'ci.yml',
    );
    const workflow = fs.readFileSync(workflowPath, 'utf8');

    expect(workflow).toContain('npm audit --omit=dev --audit-level=moderate');
    expect(workflow).not.toContain(
      '\n      - run: npm audit --audit-level=moderate',
    );
  });
});
