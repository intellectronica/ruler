import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { readMarkdownFiles } from '../../../src/core/FileSystemUtils';
import { SKILLS_DIR } from '../../../src/constants';

describe('FileSystemUtils - skills exclusion', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-skills-test-'));
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('ignores .ruler/skills markdown files when concatenating rules', async () => {
    const rulerDir = path.join(tmpDir, '.ruler');
    const skillsReferencesDir = path.join(
      rulerDir,
      SKILLS_DIR,
      'effect',
      'references',
    );

    await fs.mkdir(skillsReferencesDir, { recursive: true });

    const rootAgents = path.join(rulerDir, 'AGENTS.md');
    const extraRule = path.join(rulerDir, 'guide.md');
    const skillFile = path.join(rulerDir, SKILLS_DIR, 'effect', 'SKILL.md');
    const skillReference = path.join(skillsReferencesDir, 'data-types.md');

    await fs.writeFile(rootAgents, '# Root rules');
    await fs.writeFile(extraRule, 'Additional guidance');
    await fs.writeFile(skillFile, '# Skill content');
    await fs.writeFile(skillReference, '# Skill reference');

    const files = await readMarkdownFiles(rulerDir);
    const paths = files.map((f) => f.path);

    expect(paths).toHaveLength(2);
    expect(paths).toEqual(expect.arrayContaining([rootAgents, extraRule]));
    expect(paths).toEqual(
      expect.not.arrayContaining([skillFile, skillReference]),
    );
  });
});
