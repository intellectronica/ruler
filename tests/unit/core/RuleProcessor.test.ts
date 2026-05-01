import * as path from 'path';
import { concatenateRules } from '../../../src/core/RuleProcessor';

describe('RuleProcessor', () => {
  it('concatenates and formats rule content with source markers', () => {
    const files = [
      { path: '/project/.ruler/a.md', content: 'A rule' },
      { path: '/project/.ruler/b.md', content: 'B rule' },
    ];
    const result = concatenateRules(files, '/project');
    expect(result).toContain('<!-- Source: .ruler/a.md -->');
    expect(result).toContain('A rule');
    expect(result).toContain('<!-- Source: .ruler/b.md -->');
    expect(result).toContain('B rule');

    // Whitespace checks: two blank lines before, one after marker before content
    const markerIndex = result.indexOf('<!-- Source: .ruler/a.md -->');
    const prefix = result.slice(0, markerIndex);
    // Expect prefix ends with two newlines (i.e., there is an empty line immediately before marker and another one before that)
    expect(/\n\n$/.test(prefix)).toBe(true);
    const afterMarker = result.slice(
      markerIndex + '<!-- Source: .ruler/a.md -->'.length,
    );
    // After marker should start with a single blank line then content (i.e., exactly two leading newlines before first char of content relative to start of marker suffix)
    expect(afterMarker.startsWith('\n\nA rule')).toBe(true);
    // And not three newlines
    expect(afterMarker.startsWith('\n\n\n')).toBe(false);
  });

  it('falls back to process.cwd() when baseDir is not provided', () => {
    const cwd = process.cwd();
    const files = [
      { path: path.join(cwd, '.ruler', 'a.md'), content: 'A rule' },
    ];
    const result = concatenateRules(files);
    expect(result).toContain('<!-- Source: .ruler/a.md -->');
  });

  it('returns an empty string for an empty file list', () => {
    expect(concatenateRules([])).toBe('');
  });

  it('trims content but preserves a single trailing newline per section', () => {
    const files = [
      { path: '/project/.ruler/a.md', content: '\n\n  body  \n\n\n' },
    ];
    const result = concatenateRules(files, '/project');
    // Content is trimmed, so only `body` stays without surrounding blank lines.
    expect(result).toMatch(/<!-- Source: \.ruler\/a\.md -->\n\nbody\n$/);
  });

  it('normalizes path separators to forward slashes for cross-platform consistency', () => {
    const files = [
      {
        path: path.join('/project', '.ruler', 'subfolder', 'windows-style.md'),
        content: 'Windows content',
      },
      { path: '/project/.ruler/unix-style.md', content: 'Unix content' },
    ];
    const result = concatenateRules(files, '/project');

    // Should always use forward slashes in source markers, regardless of OS
    expect(result).toContain(
      '<!-- Source: .ruler/subfolder/windows-style.md -->',
    );
    expect(result).toContain('<!-- Source: .ruler/unix-style.md -->');
    expect(result).not.toContain('\\'); // Should not contain any backslashes
  });
});
