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

  it('does not allow workflow dispatch to bypass the main branch check', () => {
    const workflowPath = path.join(
      process.cwd(),
      '.github',
      'workflows',
      'ruler.yml',
    );
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    const jobCondition =
      workflow.match(/^\s+if:\s+\${{(?<condition>.+)}}$/m)?.groups?.condition ??
      '';

    expect(jobCondition).toContain("github.ref == 'refs/heads/main'");
    expect(jobCondition).not.toContain(
      "|| github.event_name == 'workflow_dispatch'",
    );
  });
});
