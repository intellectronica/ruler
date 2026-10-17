import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { inspectOpenCodeSkills } from '../../../src/core/OpenCodeSkills';
import { propagateSkillsForOpenCode } from '../../../src/core/SkillsProcessor';
import * as Constants from '../../../src/constants';

// Root and Windows can read files even when their POSIX mode is 000.
const itWithReadPermissions =
  process.platform === 'win32' || process.getuid?.() === 0 ? it.skip : it;

describe('inspectOpenCodeSkills', () => {
  let projectRoot: string;

  /** Writes a skill fixture at a project-relative discovery path. */
  async function writeSkill(
    root: string,
    directory: string,
    markdown: string,
  ): Promise<void> {
    const skillDir = path.join(root, directory);
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), markdown);
  }

  /** Builds valid skill Markdown with overridable metadata and instructions. */
  const skill = (name: string, description = 'A useful skill', body = 'body') =>
    `---\nname: ${name}\ndescription: ${description}\n---\n${body}\n`;

  beforeEach(async () => {
    projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'opencode-skills-'));
  });

  afterEach(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it('returns no diagnostics for valid skills and ignores symlinked directories', async () => {
    await writeSkill(
      projectRoot,
      '.ruler/skills/group/valid-skill',
      skill('valid-skill'),
    );
    await writeSkill(
      projectRoot,
      'outside/linked-skill',
      skill('linked-skill'),
    );
    await fs.symlink(
      path.join(projectRoot, 'outside/linked-skill'),
      path.join(projectRoot, '.ruler/skills/linked-skill'),
      'dir',
    );

    await expect(inspectOpenCodeSkills(projectRoot)).resolves.toEqual([]);
  });

  it('ignores a symlinked source root and an empty source directory', async () => {
    await fs.mkdir(path.join(projectRoot, '.ruler'), { recursive: true });
    await fs.mkdir(path.join(projectRoot, 'outside-skills'), {
      recursive: true,
    });
    await fs.symlink(
      path.join(projectRoot, 'outside-skills'),
      path.join(projectRoot, '.ruler/skills'),
      'dir',
    );
    await expect(inspectOpenCodeSkills(projectRoot)).resolves.toEqual([]);

    await fs.rm(path.join(projectRoot, '.ruler/skills'));
    await fs.mkdir(path.join(projectRoot, '.ruler/skills'), {
      recursive: true,
    });
    await expect(inspectOpenCodeSkills(projectRoot)).resolves.toEqual([]);
  });

  it('ignores symlinked native roots and symlinked files during comparisons', async () => {
    await writeSkill(
      projectRoot,
      '.ruler/skills/root-link',
      skill('root-link'),
    );
    await fs.writeFile(path.join(projectRoot, 'outside-asset'), 'outside');
    await fs.symlink(
      path.join(projectRoot, 'outside-asset'),
      path.join(projectRoot, '.ruler/skills/root-link/asset'),
      'file',
    );
    await writeSkill(
      projectRoot,
      'outside-native/root-link',
      skill('root-link'),
    );
    await fs.mkdir(path.join(projectRoot, '.claude'), { recursive: true });
    await fs.symlink(
      path.join(projectRoot, 'outside-native'),
      path.join(projectRoot, '.claude/skills'),
      'dir',
    );

    await expect(inspectOpenCodeSkills(projectRoot)).resolves.toEqual([]);
  });

  it('reports missing and malformed frontmatter fields with source-relative paths', async () => {
    await writeSkill(projectRoot, '.ruler/skills/no-frontmatter', 'Just text');
    await writeSkill(
      projectRoot,
      '.ruler/skills/bad-name',
      skill('Bad_Name', 'A description'),
    );
    await writeSkill(
      projectRoot,
      '.ruler/skills/empty-description',
      skill('empty-description', '  '),
    );
    await writeSkill(
      projectRoot,
      '.ruler/skills/long-description',
      skill('long-description', 'x'.repeat(1025)),
    );
    await writeSkill(
      projectRoot,
      '.ruler/skills/name-mismatch',
      skill('another-name'),
    );
    await writeSkill(
      projectRoot,
      '.ruler/skills/bad-yaml',
      '---\nname: [broken\ndescription: nope\n---\n',
    );
    await writeSkill(
      projectRoot,
      '.ruler/skills/non-mapping',
      '---\n- one\n- two\n---\n',
    );

    const warnings = await inspectOpenCodeSkills(projectRoot);

    expect(warnings).toHaveLength(7);
    expect(warnings.join('\n')).toContain(
      '.ruler/skills/no-frontmatter/SKILL.md',
    );
    expect(warnings.join('\n')).toContain('.ruler/skills/bad-name/SKILL.md');
    expect(warnings.join('\n')).toContain(
      '.ruler/skills/empty-description/SKILL.md',
    );
    expect(warnings.join('\n')).toContain(
      '.ruler/skills/long-description/SKILL.md',
    );
    expect(warnings.join('\n')).toContain(
      '.ruler/skills/name-mismatch/SKILL.md',
    );
    expect(warnings.join('\n')).toContain(
      '.ruler/skills/bad-yaml/SKILL.md has invalid YAML',
    );
    expect(warnings.join('\n')).toContain(
      '.ruler/skills/non-mapping/SKILL.md must contain a YAML mapping',
    );
  });

  it('reports duplicate source names and divergent native definitions', async () => {
    await writeSkill(
      projectRoot,
      '.ruler/skills/group-a/shared',
      skill('shared', 'source', 'same'),
    );
    await writeSkill(
      projectRoot,
      '.ruler/skills/group-b/shared',
      skill('shared', 'source', 'same'),
    );
    await writeSkill(
      projectRoot,
      '.claude/skills/shared',
      skill('shared', 'native', 'different'),
    );

    const warnings = await inspectOpenCodeSkills(projectRoot);

    expect(warnings.join('\n')).toContain('duplicate skill name "shared"');
    expect(warnings.join('\n')).toContain('.claude/skills/shared');
    expect(warnings.join('\n')).toContain(
      'contents that differ from .ruler/skills',
    );
  });

  it('discovers skills nested below another skill directory', async () => {
    await writeSkill(
      projectRoot,
      '.ruler/skills/outer',
      skill('outer', 'outer source', 'outer body'),
    );
    await writeSkill(
      projectRoot,
      '.ruler/skills/outer/inner',
      skill('inner', 'inner source', 'source body'),
    );
    await writeSkill(
      projectRoot,
      '.ruler/skills/group/inner',
      skill('inner', 'second inner source', 'other source body'),
    );
    await writeSkill(
      projectRoot,
      '.claude/skills/inner',
      skill('inner', 'native definition', 'native body'),
    );

    const warnings = await inspectOpenCodeSkills(projectRoot);

    expect(warnings.join('\n')).toContain(
      'duplicate skill name "inner" in .ruler/skills/group/inner, .ruler/skills/outer/inner',
    );
    expect(warnings.join('\n')).toContain(
      '.claude/skills/inner defines "inner" with contents that differ from .ruler/skills',
    );
  });

  it('does not warn for identical native duplicates or Ruler-managed target entries', async () => {
    const definition = skill('same-skill', 'shared definition', 'same body');
    await writeSkill(projectRoot, '.ruler/skills/same-skill', definition);
    await writeSkill(projectRoot, '.claude/skills/same-skill', definition);
    await writeSkill(
      projectRoot,
      '.opencode/skills/same-skill',
      skill('same-skill', 'old managed content'),
    );
    await fs.writeFile(
      path.join(projectRoot, '.opencode/skills/.ruler-managed.json'),
      JSON.stringify({ version: 1, paths: ['same-skill'] }),
    );

    await expect(inspectOpenCodeSkills(projectRoot)).resolves.toEqual([]);
  });

  it('uses native frontmatter names and reports only actual name collisions', async () => {
    await writeSkill(
      projectRoot,
      '.ruler/skills/source-name',
      skill('source-name'),
    );
    await writeSkill(
      projectRoot,
      '.claude/skills/unrelated-folder',
      skill('source-name', 'different native definition'),
    );
    await writeSkill(
      projectRoot,
      '.claude/skills/source-name',
      skill('different-name', 'not a collision'),
    );
    await writeSkill(
      projectRoot,
      '.claude/skills/malformed-native',
      '---\nname: [broken\n---\n',
    );
    await writeSkill(
      projectRoot,
      '.claude/skills/non-mapping-native',
      '---\n- item\n---\n',
    );

    const warnings = await inspectOpenCodeSkills(projectRoot);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('.claude/skills/unrelated-folder');
    expect(warnings[0]).toContain('defines "source-name"');
  });

  it('detects different nested assets and ignores symlinked asset entries', async () => {
    await writeSkill(
      projectRoot,
      '.ruler/skills/asset-skill',
      skill('asset-skill'),
    );
    await fs.writeFile(
      path.join(projectRoot, '.ruler/skills/asset-skill', 'script.sh'),
      '#!/bin/sh\necho source\n',
    );
    await fs.mkdir(
      path.join(projectRoot, '.ruler/skills/asset-skill', 'assets'),
    );
    await fs.writeFile(
      path.join(projectRoot, '.ruler/skills/asset-skill/assets/data.txt'),
      'source',
    );
    await writeSkill(
      projectRoot,
      '.claude/skills/asset-skill',
      skill('asset-skill'),
    );
    await fs.writeFile(
      path.join(projectRoot, '.claude/skills/asset-skill', 'script.sh'),
      '#!/bin/sh\necho source\n',
    );
    await fs.mkdir(
      path.join(projectRoot, '.claude/skills/asset-skill', 'assets'),
    );
    await fs.writeFile(
      path.join(projectRoot, '.claude/skills/asset-skill/assets/data.txt'),
      'native',
    );
    await fs.writeFile(path.join(projectRoot, 'linked-asset'), 'outside');
    await fs.symlink(
      path.join(projectRoot, 'linked-asset'),
      path.join(projectRoot, '.ruler/skills/asset-skill', 'linked.txt'),
      'file',
    );

    const warnings = await inspectOpenCodeSkills(projectRoot);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('.claude/skills/asset-skill');
    expect(warnings[0]).toContain('contents that differ');
  });

  it('keeps stale managed Claude and Agents definitions in collision checks', async () => {
    await writeSkill(
      projectRoot,
      '.ruler/skills/managed-skill',
      skill('managed-skill'),
    );
    for (const target of ['.claude/skills', '.agents/skills']) {
      await writeSkill(
        projectRoot,
        `${target}/managed-skill`,
        skill('managed-skill', 'stale native content'),
      );
      await fs.writeFile(
        path.join(projectRoot, target, '.ruler-managed.json'),
        JSON.stringify({ version: 1, paths: ['managed-skill'] }),
      );
    }

    const warnings = await inspectOpenCodeSkills(projectRoot);

    expect(warnings).toHaveLength(2);
    expect(warnings.join('\n')).toContain('.claude/skills/managed-skill');
    expect(warnings.join('\n')).toContain('.agents/skills/managed-skill');
  });

  itWithReadPermissions(
    'reports unreadable compared assets without rejecting diagnostics',
    async () => {
      await writeSkill(
        projectRoot,
        '.ruler/skills/read-error',
        skill('read-error'),
      );
      await fs.writeFile(
        path.join(projectRoot, '.ruler/skills/read-error', 'asset'),
        'same',
      );
      await writeSkill(
        projectRoot,
        '.claude/skills/read-error',
        skill('read-error'),
      );
      await fs.writeFile(
        path.join(projectRoot, '.claude/skills/read-error', 'asset'),
        'same',
      );
      const unreadableAsset = path.join(
        projectRoot,
        '.claude/skills/read-error/asset',
      );
      await fs.chmod(unreadableAsset, 0o000);
      try {
        const warnings = await inspectOpenCodeSkills(projectRoot);
        expect(warnings.join('\n')).toContain('could not compare');
      } finally {
        await fs.chmod(unreadableAsset, 0o600);
      }
    },
  );

  it('copies skill metadata, scripts, and assets unchanged during OpenCode propagation', async () => {
    const metadata = skill('copied-skill', 'source metadata', 'source body');
    await writeSkill(projectRoot, '.ruler/skills/copied-skill', metadata);
    await fs.writeFile(
      path.join(projectRoot, '.ruler/skills/copied-skill', 'run.sh'),
      '#!/bin/sh\necho unchanged\n',
      { mode: 0o755 },
    );
    await fs.mkdir(
      path.join(projectRoot, '.ruler/skills/copied-skill', 'assets'),
    );
    await fs.writeFile(
      path.join(projectRoot, '.ruler/skills/copied-skill/assets/data.bin'),
      Buffer.from([0, 1, 127, 255]),
    );

    await propagateSkillsForOpenCode(projectRoot, { dryRun: false });

    const target = path.join(projectRoot, '.opencode/skills/copied-skill');
    expect(await fs.readFile(path.join(target, 'SKILL.md'), 'utf8')).toBe(
      metadata,
    );
    expect(await fs.readFile(path.join(target, 'run.sh'), 'utf8')).toBe(
      '#!/bin/sh\necho unchanged\n',
    );
    expect(await fs.readFile(path.join(target, 'assets/data.bin'))).toEqual(
      Buffer.from([0, 1, 127, 255]),
    );
  });

  it('logs diagnostics during dry runs without filtering skills or copy steps', async () => {
    await writeSkill(
      projectRoot,
      '.ruler/skills/invalid_skill',
      skill('Invalid_skill'),
    );
    const warn = jest.spyOn(Constants, 'logWarn').mockImplementation();

    const steps = await propagateSkillsForOpenCode(projectRoot, {
      dryRun: true,
    });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('invalid_skill/SKILL.md'),
      true,
    );
    expect(steps).toEqual([
      'Copy skills from .ruler/skills to .opencode/skills',
    ]);
    warn.mockRestore();
  });
});
