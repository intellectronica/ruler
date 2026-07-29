import * as fs from 'fs';
import * as path from 'path';

describe('GitHub Actions pins', () => {
  it('pins external GitHub actions to immutable commit SHAs', () => {
    const workflowsDir = path.join(process.cwd(), '.github', 'workflows');
    const workflowText = fs
      .readdirSync(workflowsDir)
      .filter((fileName) => fileName.endsWith('.yml'))
      .map((fileName) =>
        fs.readFileSync(path.join(workflowsDir, fileName), 'utf8'),
      )
      .join('\n');

    const mutableActionUses = [...workflowText.matchAll(/uses:\s*([^\s#]+)/g)]
      .map((match) => match[1])
      .filter((uses) => uses.startsWith('actions/'))
      .filter((uses) => !/@[a-f0-9]{40}$/i.test(uses));

    expect(mutableActionUses).toEqual([]);
    expect(workflowText).toMatch(
      /uses:\s*actions\/checkout@[a-f0-9]{40}(?:\s*#.*)?$/im,
    );
    expect(workflowText).toMatch(
      /uses:\s*actions\/setup-node@[a-f0-9]{40}(?:\s*#.*)?$/im,
    );
  });

  it('configures Dependabot to refresh pinned GitHub Actions', () => {
    const dependabotPath = path.join(
      process.cwd(),
      '.github',
      'dependabot.yml',
    );
    const dependabotConfig = fs.readFileSync(dependabotPath, 'utf8');

    expect(dependabotConfig).toContain('package-ecosystem: github-actions');
    expect(dependabotConfig).toContain('directory: /');
    expect(dependabotConfig).toContain('interval: weekly');
  });
});
