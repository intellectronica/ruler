import * as path from 'path';

/**
 * Concatenates markdown rule files into a single string,
 * marking each section with its source filename.
 */
export function concatenateRules(
  files: { path: string; content: string }[],
  baseDir?: string,
): string {
  const base = baseDir || process.cwd();
  const sections = files.map(({ path: filePath, content }) => {
    const rel = path.relative(base, filePath);
    // Normalize path separators to forward slashes for consistent output across platforms
    const normalizedRel = rel.replace(/\\/g, '/');
    // New format: two leading blank lines, HTML comment with source, one blank line, then content, then trailing newline
    // We intentionally trim content to avoid cascading blank lines, then ensure a final newline via join logic
    return [
      '', // first leading blank line
      '', // second leading blank line
      `<!-- Source: ${normalizedRel} -->`,
      '', // single blank line after the comment
      content.trim(),
      '', // ensure file section ends with newline
    ].join('\n');
  });
  return sections.join('\n');
}
