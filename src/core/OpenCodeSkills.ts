import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';

const SOURCE_SKILLS = '.ruler/skills';
const NATIVE_SKILLS = ['.claude/skills', '.agents/skills', '.opencode/skills'];
const MANIFEST = '.ruler-managed.json';
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface SkillDefinition {
  name: string;
  directory: string;
  relativeDirectory: string;
}

async function findSkillDirectories(root: string): Promise<string[]> {
  const found: string[] = [];

  try {
    if ((await fs.lstat(root)).isSymbolicLink()) return found;
  } catch {
    return found;
  }

  async function walk(directory: string): Promise<void> {
    let entries: import('fs').Dirent[];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    if (entries.some((entry) => entry.isFile() && entry.name === 'SKILL.md')) {
      found.push(directory);
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await walk(path.join(directory, entry.name));
      }
    }
  }

  await walk(root);
  return found.sort();
}

function relative(projectRoot: string, filePath: string): string {
  return path.relative(projectRoot, filePath).split(path.sep).join('/');
}

async function parseDefinition(
  projectRoot: string,
  directory: string,
  expectedName: string,
): Promise<{ definition?: SkillDefinition; warning?: string }> {
  const skillPath = path.join(directory, 'SKILL.md');
  const displayPath = relative(projectRoot, skillPath);
  let raw: string;
  try {
    raw = await fs.readFile(skillPath, 'utf8');
  } catch (error) {
    return {
      warning: `OpenCode skill diagnostic: could not read ${displayPath}: ${String(error)}`,
    };
  }

  const match = FRONTMATTER_RE.exec(raw);
  if (!match) {
    return {
      warning: `OpenCode skill diagnostic: ${displayPath} is missing YAML frontmatter.`,
    };
  }

  let metadata: unknown;
  try {
    metadata = yaml.load(match[1]);
  } catch (error) {
    const detail =
      error instanceof Error ? error.message.split('\n')[0] : String(error);
    return {
      warning: `OpenCode skill diagnostic: ${displayPath} has invalid YAML frontmatter: ${detail}.`,
    };
  }
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {
      warning: `OpenCode skill diagnostic: ${displayPath} must contain a YAML mapping.`,
    };
  }

  const fields = metadata as Record<string, unknown>;
  const name = fields.name;
  const description = fields.description;
  if (
    typeof name !== 'string' ||
    name.length < 1 ||
    name.length > 64 ||
    !NAME_RE.test(name)
  ) {
    return {
      warning: `OpenCode skill diagnostic: ${displayPath} has an invalid name; expected 1-64 lowercase letters, digits, or hyphens.`,
    };
  }
  if (name !== expectedName) {
    return {
      warning: `OpenCode skill diagnostic: ${displayPath} declares name "${name}", which does not match its parent directory "${expectedName}".`,
    };
  }
  if (
    typeof description !== 'string' ||
    description.trim().length === 0 ||
    description.length > 1024
  ) {
    return {
      warning: `OpenCode skill diagnostic: ${displayPath} has an invalid description; it must be non-empty and at most 1024 characters.`,
    };
  }

  return {
    definition: {
      name,
      directory,
      relativeDirectory: relative(projectRoot, directory),
    },
  };
}

async function readManagedEntries(targetRoot: string): Promise<Set<string>> {
  try {
    const parsed = JSON.parse(
      await fs.readFile(path.join(targetRoot, MANIFEST), 'utf8'),
    ) as { paths?: unknown };
    return new Set(
      Array.isArray(parsed.paths)
        ? parsed.paths.filter((p): p is string => typeof p === 'string')
        : [],
    );
  } catch {
    return new Set();
  }
}

async function readNativeName(directory: string): Promise<string | undefined> {
  try {
    const raw = await fs.readFile(path.join(directory, 'SKILL.md'), 'utf8');
    const match = FRONTMATTER_RE.exec(raw);
    if (!match) return undefined;
    const metadata = yaml.load(match[1]);
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return undefined;
    }
    const name = (metadata as Record<string, unknown>).name;
    return typeof name === 'string' ? name : undefined;
  } catch {
    // Native skills are user-owned. A malformed definition cannot establish a collision.
    return undefined;
  }
}

async function directoryContentsMatch(
  left: string,
  right: string,
): Promise<'same' | 'different' | 'unreadable'> {
  const entries = async (directory: string) => {
    try {
      return await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return null;
    }
  };
  const [leftEntries, rightEntries] = await Promise.all([
    entries(left),
    entries(right),
  ]);
  if (!leftEntries || !rightEntries) return 'unreadable';
  const regular = (items: import('fs').Dirent[]) =>
    items
      .filter((item) => item.isDirectory() || item.isFile())
      .sort((a, b) => a.name.localeCompare(b.name));
  const a = regular(leftEntries);
  const b = regular(rightEntries);
  if (
    a.length !== b.length ||
    a.some(
      (entry, index) =>
        entry.name !== b[index].name ||
        entry.isDirectory() !== b[index].isDirectory(),
    )
  ) {
    return 'different';
  }
  for (let index = 0; index < a.length; index += 1) {
    const aPath = path.join(left, a[index].name);
    const bPath = path.join(right, b[index].name);
    if (a[index].isDirectory()) {
      const result = await directoryContentsMatch(aPath, bPath);
      if (result !== 'same') return result;
    } else {
      try {
        const [aBytes, bBytes] = await Promise.all([
          fs.readFile(aPath),
          fs.readFile(bPath),
        ]);
        if (!aBytes.equals(bBytes)) return 'different';
      } catch {
        return 'unreadable';
      }
    }
  }
  return 'same';
}

/** Returns OpenCode-specific skill diagnostics without changing or filtering source files. */
export async function inspectOpenCodeSkills(
  projectRoot: string,
): Promise<string[]> {
  const sourceRoot = path.join(projectRoot, SOURCE_SKILLS);
  try {
    await fs.access(sourceRoot);
  } catch {
    return [];
  }

  const warnings: string[] = [];
  const definitions: SkillDefinition[] = [];
  for (const directory of await findSkillDirectories(sourceRoot)) {
    const result = await parseDefinition(
      projectRoot,
      directory,
      path.basename(directory),
    );
    if (result.warning) warnings.push(result.warning);
    if (result.definition) definitions.push(result.definition);
  }

  const sourceByName = new Map<string, SkillDefinition[]>();
  for (const definition of definitions) {
    const matches = sourceByName.get(definition.name) ?? [];
    matches.push(definition);
    sourceByName.set(definition.name, matches);
  }
  for (const [name, matches] of sourceByName) {
    if (matches.length > 1) {
      warnings.push(
        `OpenCode skill diagnostic: duplicate skill name "${name}" in ${matches.map((item) => item.relativeDirectory).join(', ')}.`,
      );
    }
  }

  for (const nativePath of NATIVE_SKILLS) {
    const targetRoot = path.join(projectRoot, nativePath);
    const managed =
      nativePath === '.opencode/skills'
        ? await readManagedEntries(targetRoot)
        : new Set<string>();
    for (const directory of await findSkillDirectories(targetRoot)) {
      const targetRelativeDir = path
        .relative(targetRoot, directory)
        .split(path.sep)
        .join('/');
      if (
        managed.has(targetRelativeDir) ||
        managed.has(targetRelativeDir.split('/')[0])
      )
        continue;
      const name = await readNativeName(directory);
      if (!name) continue;
      const sources = sourceByName.get(name);
      if (!sources?.length) continue;
      const comparisons = await Promise.all(
        sources.map((source) =>
          directoryContentsMatch(source.directory, directory),
        ),
      );
      if (comparisons.includes('unreadable')) {
        warnings.push(
          `OpenCode skill diagnostic: could not compare ${relative(projectRoot, directory)} with .ruler/skills because one or more files could not be read.`,
        );
      } else if (!comparisons.includes('same')) {
        warnings.push(
          `OpenCode skill diagnostic: ${relative(projectRoot, directory)} defines "${name}" with contents that differ from .ruler/skills (${sources.map((source) => source.relativeDirectory).join(', ')}).`,
        );
      }
    }
  }

  return warnings;
}
