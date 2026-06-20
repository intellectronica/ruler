import * as fs from 'fs';
import * as path from 'path';

describe('This Codebase Smells workflow', () => {
  it('does not grant shell access to the Copilot analysis step', () => {
    const workflowPath = path.join(
      process.cwd(),
      '.github',
      'workflows',
      'this-codebase-smells.yml',
    );
    const workflow = fs.readFileSync(workflowPath, 'utf8');

    expect(workflow).not.toContain("--allow-tool 'shell(*)'");
    expect(workflow).toContain("--allow-tool 'read_file(*)'");
    expect(workflow).toContain("--allow-tool 'glob(*)'");
    expect(workflow).toContain(
      'GITHUB_TOKEN: ${{ secrets.COPILOT_CLI_TOKEN }}',
    );
  });
});
