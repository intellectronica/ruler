import * as fs from 'fs';
import * as path from 'path';

describe('GitHub Actions pins', () => {
  it('uses current checkout and setup-node action majors', () => {
    const workflowsDir = path.join(process.cwd(), '.github', 'workflows');
    const workflowText = fs
      .readdirSync(workflowsDir)
      .filter((fileName) => fileName.endsWith('.yml'))
      .map((fileName) =>
        fs.readFileSync(path.join(workflowsDir, fileName), 'utf8'),
      )
      .join('\n');

    expect(workflowText).not.toContain('actions/checkout@v4');
    expect(workflowText).not.toContain('actions/setup-node@v4');
    expect(workflowText).toContain('actions/checkout@v7');
    expect(workflowText).toContain('actions/setup-node@v6');
  });
});
