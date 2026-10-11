import { PROJECT_KEY_PATTERN, suggestProjectKey } from './projects';

describe('PROJECT_KEY_PATTERN', () => {
  it.each(['TF', 'WEB', 'WEB2', 'ABCDEFGHIJ'])('accepts %p', (key) => {
    expect(PROJECT_KEY_PATTERN.test(key)).toBe(true);
  });

  it.each(['T', 'tf', '2TF', 'T-F', 'ABCDEFGHIJK', ''])('rejects %p', (key) => {
    expect(PROJECT_KEY_PATTERN.test(key)).toBe(false);
  });
});

describe('suggestProjectKey', () => {
  it.each([
    ['Team Flow web', 'TFW'],
    ['Marketing', 'MAR'],
    ['  mobile   app ', 'MA'],
    ['Q4 launch', 'QL'],
  ])('%p -> %p', (name, expected) => {
    expect(suggestProjectKey(name)).toBe(expected);
  });

  it('drops leading digits so the key starts with a letter', () => {
    expect(suggestProjectKey('2026 Roadmap')).toBe('');
    expect(suggestProjectKey('2026roadmap')).toBe('ROA');
  });

  it('ignores punctuation', () => {
    expect(suggestProjectKey('R&D / Platform')).toBe('RDP');
  });

  it('returns an empty string when nothing usable remains', () => {
    expect(suggestProjectKey('!!!')).toBe('');
    expect(suggestProjectKey('')).toBe('');
    expect(suggestProjectKey('a')).toBe('');
  });

  it('never exceeds the maximum length', () => {
    const name = 'a b c d e f g h i j k l m';
    expect(suggestProjectKey(name)).toBe('ABCDEFGHIJ');
  });

  it('always produces a valid key or nothing', () => {
    for (const name of [
      'Team Flow web',
      'Marketing',
      'R&D / Platform',
      '2026roadmap',
    ]) {
      expect(PROJECT_KEY_PATTERN.test(suggestProjectKey(name))).toBe(true);
    }
  });
});
