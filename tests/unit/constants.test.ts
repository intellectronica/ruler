import { DEFAULT_RULES_FILENAME, actionPrefix } from '../../src/constants';

describe('constants', () => {
  it('exports DEFAULT_RULES_FILENAME as AGENTS.md (new default)', () => {
    expect(DEFAULT_RULES_FILENAME).toBe('AGENTS.md');
  });

  describe('actionPrefix', () => {
    it('returns [ruler:dry-run] when dry is true', () => {
      expect(actionPrefix(true)).toBe('[ruler:dry-run]');
    });

    it('returns [ruler] when dry is false', () => {
      expect(actionPrefix(false)).toBe('[ruler]');
    });
  });
});
