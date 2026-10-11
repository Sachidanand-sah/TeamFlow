import {
  canAssignRole,
  canManageMember,
  hasAtLeastRole,
  WORKSPACE_ROLES,
  WorkspaceRole,
} from './workspaces';

describe('workspace role rules', () => {
  describe('hasAtLeastRole', () => {
    it.each<[WorkspaceRole, WorkspaceRole, boolean]>([
      ['OWNER', 'ADMIN', true],
      ['ADMIN', 'ADMIN', true],
      ['MEMBER', 'ADMIN', false],
      ['VIEWER', 'VIEWER', true],
      ['VIEWER', 'MEMBER', false],
    ])('%s >= %s is %s', (role, minimum, expected) => {
      expect(hasAtLeastRole(role, minimum)).toBe(expected);
    });

    it('every role satisfies VIEWER', () => {
      for (const role of WORKSPACE_ROLES) {
        expect(hasAtLeastRole(role, 'VIEWER')).toBe(true);
      }
    });
  });

  describe('canManageMember', () => {
    it.each<[WorkspaceRole, WorkspaceRole, boolean]>([
      ['OWNER', 'ADMIN', true],
      ['OWNER', 'VIEWER', true],
      ['OWNER', 'OWNER', false],
      ['ADMIN', 'MEMBER', true],
      ['ADMIN', 'VIEWER', true],
      ['ADMIN', 'ADMIN', false],
      ['ADMIN', 'OWNER', false],
      ['MEMBER', 'VIEWER', false],
      ['VIEWER', 'VIEWER', false],
    ])('%s managing %s is %s', (actor, target, expected) => {
      expect(canManageMember(actor, target)).toBe(expected);
    });
  });

  describe('canAssignRole', () => {
    it.each<[WorkspaceRole, WorkspaceRole, boolean]>([
      ['OWNER', 'ADMIN', true],
      ['OWNER', 'OWNER', false],
      ['ADMIN', 'ADMIN', false],
      ['ADMIN', 'MEMBER', true],
      ['ADMIN', 'VIEWER', true],
      ['MEMBER', 'VIEWER', false],
    ])('%s granting %s is %s', (actor, role, expected) => {
      expect(canAssignRole(actor, role)).toBe(expected);
    });
  });
});
