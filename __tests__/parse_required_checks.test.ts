import parseRequiredChecks from '../src/parse_required_checks';

describe('parseRequiredChecks', () => {
  it('returns array from comma-separated list', () => {
    expect(parseRequiredChecks('foo,bar')).toEqual(['foo', 'bar']);
  });

  it('returns empty array for blank string', () => {
    expect(parseRequiredChecks('')).toEqual([]);
  });
});
