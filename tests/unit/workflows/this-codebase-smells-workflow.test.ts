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

  it('installs a pinned Copilot CLI version before using the token', () => {
    const workflowPath = path.join(
      process.cwd(),
      '.github',
      'workflows',
      'this-codebase-smells.yml',
    );
    const workflow = fs.readFileSync(workflowPath, 'utf8');

    const installIndex = workflow.indexOf('npm install -g "@github/copilot@');
    const tokenIndex = workflow.indexOf(
      'GITHUB_TOKEN: ${{ secrets.COPILOT_CLI_TOKEN }}',
    );

    expect(workflow).toContain("COPILOT_CLI_VERSION: '1.0.68'");
    expect(workflow).not.toContain('npm install -g @github/copilot\n');
    expect(installIndex).toBeGreaterThanOrEqual(0);
    expect(tokenIndex).toBeGreaterThanOrEqual(0);
    expect(installIndex).toBeLessThan(tokenIndex);
  });
});
