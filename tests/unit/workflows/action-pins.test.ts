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
      'actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0',
    );
    expect(workflowText).toContain(
      'actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e',
    );
  });
});
