import * as fs from 'fs/promises';
import * as path from 'path';
import { applyAllAgentConfigs } from '../../src/lib';
import { setupTestProject, teardownTestProject } from '../harness';
import { SKILLS_DIR } from '../../src/constants';

const SHARED_TOML_CONFIG = `default_agents = ["claude", "copilot"]
nested = true

[agents]
[agents.claude]
enabled = true

[agents.copilot]
enabled = true
`;

describe('Nested skills handling', () => {
  let projectRoot: string;

  beforeEach(async () => {
    ({ projectRoot } = await setupTestProject());
  });

  afterEach(async () => {
    await teardownTestProject(projectRoot);
  });

  it('excludes .ruler/skills files from concatenated rules while still propagating skills', async () => {
    const moduleDir = path.join(projectRoot, 'packages', 'core');
    await fs.mkdir(path.join(projectRoot, '.ruler', SKILLS_DIR, 'effect'), {
      recursive: true,
    });
    await fs.mkdir(path.join(moduleDir, '.ruler'), { recursive: true });

    const rootRules = path.join(projectRoot, '.ruler', 'AGENTS.md');
    const moduleRules = path.join(moduleDir, '.ruler', 'AGENTS.md');
    const skillDefinition = path.join(
      projectRoot,
      '.ruler',
      SKILLS_DIR,
      'effect',
      'SKILL.md',
    );
    const skillReference = path.join(
      projectRoot,
      '.ruler',
      SKILLS_DIR,
      'effect',
      'references',
      'data-types.md',
    );

    await fs.mkdir(path.dirname(skillReference), { recursive: true });

    await fs.writeFile(
      rootRules,
      '# Root rules\n\nRoot guidance stays in AGENTS.md only.',
    );
    await fs.writeFile(
      moduleRules,
      '# Module rules\n\nModule guidance should be isolated.',
    );
    await fs.writeFile(
      skillDefinition,
      '# Skill content\n\nDo not concatenate.',
    );
    await fs.writeFile(
      skillReference,
      '# Skill reference\n\nThis should also stay out of AGENTS.md.',
    );

    const writeToml = (baseDir: string) =>
      fs.writeFile(
        path.join(baseDir, '.ruler', 'ruler.toml'),
        SHARED_TOML_CONFIG,
      );

    await Promise.all([writeToml(projectRoot), writeToml(moduleDir)]);

    await applyAllAgentConfigs(
      projectRoot,
      ['claude', 'copilot'], // agents
      undefined, // configPath
      true, // cliMcpEnabled
      undefined, // cliMcpStrategy
      undefined, // cliGitignoreEnabled
      false, // verbose
      false, // dryRun
      false, // localOnly
      true, // nested
    );

    const rootClaude = await fs.readFile(
      path.join(projectRoot, 'CLAUDE.md'),
      'utf8',
    );
    const moduleClaude = await fs.readFile(
      path.join(moduleDir, 'CLAUDE.md'),
      'utf8',
    );

    expect(rootClaude).toContain('Root guidance stays in AGENTS.md only.');
    expect(moduleClaude).toContain('Module guidance should be isolated.');

    // Skills content should not be concatenated into rules
    expect(rootClaude).not.toContain('Skill content');
    expect(rootClaude).not.toContain('Skill reference');
    expect(moduleClaude).not.toContain('Skill content');
    expect(moduleClaude).not.toContain('Skill reference');

    // Skills should still be propagated for selected native agents
    // Claude and Copilot both map to the Claude skills destination
    const claudeSkill = path.join(projectRoot, '.claude', SKILLS_DIR, 'effect');
    const codexSkill = path.join(projectRoot, '.codex', SKILLS_DIR, 'effect');

    await expect(fs.access(claudeSkill)).resolves.toBeUndefined();
    await expect(fs.access(codexSkill)).rejects.toThrow();

    const copiedSkill = await fs.readFile(
      path.join(claudeSkill, 'SKILL.md'),
      'utf8',
    );
    expect(copiedSkill).toContain('Skill content');
  });
});
