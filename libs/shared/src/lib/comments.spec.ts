import { canComment, canDeleteComment, canEditComment } from './comments';

describe('comment permissions', () => {
  it('lets MEMBER and above comment', () => {
    expect(canComment('VIEWER')).toBe(false);
    expect(canComment('MEMBER')).toBe(true);
  });

  it.each([
    ['MEMBER', true, true],
    ['MEMBER', false, false],
    ['ADMIN', false, false],
    ['VIEWER', true, false],
  ] as const)('%s (author: %s) can edit: %s', (role, isAuthor, expected) => {
    expect(canEditComment(role, isAuthor)).toBe(expected);
  });

  it.each([
    ['MEMBER', true, true],
    ['MEMBER', false, false],
    ['ADMIN', false, true],
    ['OWNER', false, true],
    ['VIEWER', true, false],
  ] as const)('%s (author: %s) can delete: %s', (role, isAuthor, expected) => {
    expect(canDeleteComment(role, isAuthor)).toBe(expected);
  });
});
