import { DEFAULT_RULES_FILENAME } from '../../src/constants';

describe('constants', () => {
  it('exports DEFAULT_RULES_FILENAME as AGENTS.md (new default)', () => {
    expect(DEFAULT_RULES_FILENAME).toBe('AGENTS.md');
  });
});
