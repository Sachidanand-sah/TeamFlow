import { relativeTime } from './relative-time';

describe('relativeTime', () => {
  const now = new Date('2026-10-11T12:00:00.000Z');
  const ago = (seconds: number) =>
    new Date(now.getTime() - seconds * 1000).toISOString();

  it.each([
    [10, 'just now'],
    [5 * 60, '5 minutes ago'],
    [3600, '1 hour ago'],
    [24 * 3600, 'yesterday'],
    [3 * 24 * 3600, '3 days ago'],
    [14 * 24 * 3600, '2 weeks ago'],
  ])('%i seconds ago -> %p', (seconds, expected) => {
    expect(relativeTime(ago(seconds), now)).toBe(expected);
  });
});
