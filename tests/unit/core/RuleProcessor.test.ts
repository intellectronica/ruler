import * as path from 'path';
import { concatenateRules } from '../../../src/core/RuleProcessor';

describe('RuleProcessor', () => {
  it('concatenates and formats rule content with source markers', () => {
    const files = [
      { path: '/project/.ruler/a.md', content: 'A rule' },
      { path: '/project/.ruler/b.md', content: 'B rule' },
    ];
  const result = concatenateRules(files, '/project');
    expect(result).toContain('Source: .ruler/a.md');
    expect(result).toContain('A rule');
    expect(result).toContain('Source: .ruler/b.md');
    expect(result).toContain('B rule');
  });

  it('normalizes path separators to forward slashes for cross-platform consistency', () => {
    const files = [
      { path: path.join('/project', '.ruler', 'subfolder', 'windows-style.md'), content: 'Windows content' },
      { path: '/project/.ruler/unix-style.md', content: 'Unix content' },
    ];
    const result = concatenateRules(files, '/project');
    
    // Should always use forward slashes in source markers, regardless of OS
    expect(result).toContain('Source: .ruler/subfolder/windows-style.md');
    expect(result).toContain('Source: .ruler/unix-style.md');
    expect(result).not.toContain('\\'); // Should not contain any backslashes
  });
});