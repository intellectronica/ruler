import { DEFAULT_RULES_FILENAME } from '../../src/constants';

describe('constants', () => {
  it('exports DEFAULT_RULES_FILENAME as instructions.md (legacy default)', () => {
    expect(DEFAULT_RULES_FILENAME).toBe('instructions.md');
  });
});
