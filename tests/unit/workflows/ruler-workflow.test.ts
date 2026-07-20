import * as fs from 'fs';
import * as path from 'path';

describe('Ruler Apply workflow', () => {
  it('does not request unused pull request permissions', () => {
    const workflowPath = path.join(
      process.cwd(),
      '.github',
      'workflows',
      'ruler.yml',
    );
    const workflow = fs.readFileSync(workflowPath, 'utf8');

    expect(workflow).toContain('permissions:\n  contents: write');
    expect(workflow).not.toContain('pull-requests:');
  });
});
