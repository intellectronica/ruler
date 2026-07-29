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
    expect(workflowText).toContain(
      'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',
    );
    expect(workflowText).toContain(
      'actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38',
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
