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
});