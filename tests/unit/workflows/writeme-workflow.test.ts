import * as fs from 'fs';
import * as path from 'path';

describe('WRITEME workflow', () => {
  it('does not grant repository write permissions to the workflow token', () => {
    const workflowPath = path.join(
      process.cwd(),
      '.github',
      'workflows',
      'writeme.yml',
    );
    const workflow = fs.readFileSync(workflowPath, 'utf8');

    expect(workflow).toContain('permissions:\n  contents: read');
    expect(workflow).not.toContain('contents: write');
    expect(workflow).not.toContain('pull-requests: write');
  });
});
