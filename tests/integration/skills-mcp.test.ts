import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { propagateSkills } from '../../src/core/SkillsProcessor';
import { SKILL_MD_FILENAME } from '../../src/constants';
import { allAgents } from '../../src/lib';

describe('Skills MCP Integration', () => {
  let tmpDir: string;
  let originalWarn: typeof console.warn;
  let warnings: string[];

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ruler-skills-mcp-'));
    warnings = [];
    originalWarn = console.warn;
    console.warn = (...args: any[]) => {
      warnings.push(args.join(' '));
    };
  });

  afterEach(async () => {
    console.warn = originalWarn;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('warns when skills exist but agents lack native skills support', async () => {
    const skillDir = path.join(tmpDir, '.ruler', 'skills', 'test-skill');
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, SKILL_MD_FILENAME), '# Test Skill');

    const unsupportedAgent = allAgents.find(
      (agent) => agent.getIdentifier() === 'zed',
    );

    expect(unsupportedAgent).toBeDefined();

    await propagateSkills(tmpDir, [unsupportedAgent!], true, false, false);

    expect(
      warnings.some((warning) =>
        warning.includes('do not support native skills'),
      ),
    ).toBe(true);
    await expect(fs.access(path.join(tmpDir, '.skillz'))).rejects.toThrow();
  });
});
