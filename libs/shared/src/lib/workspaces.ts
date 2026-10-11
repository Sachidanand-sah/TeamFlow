/**
 * Workspace and membership contracts plus the role rules.
 *
 * The rules live here (not only in the API) so the Angular app can hide actions the
 * user is not allowed to take. The API enforces the same functions: the UI check is
 * convenience, the API check is security.
 */

/** Most to least privileged. Must match the Prisma `WorkspaceRole` enum. */
export const WORKSPACE_ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

/** Ownership is never granted through membership endpoints. */
export type AssignableWorkspaceRole = Exclude<WorkspaceRole, 'OWNER'>;
export const ASSIGNABLE_WORKSPACE_ROLES: readonly AssignableWorkspaceRole[] = [
  'ADMIN',
  'MEMBER',
  'VIEWER',
];

export const WORKSPACE_NAME_MAX_LENGTH = 80;

const RANK: Record<WorkspaceRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};

/** True if `role` is `minimum` or more privileged. */
export function hasAtLeastRole(
  role: WorkspaceRole,
  minimum: WorkspaceRole,
): boolean {
  return RANK[role] >= RANK[minimum];
}

/**
 * Whether `actor` may change or remove a member who currently has `target` role.
 * Admins and owners only, and only for people ranked strictly below them: an ADMIN
 * cannot demote another ADMIN, and nobody can touch the OWNER.
 */
export function canManageMember(
  actor: WorkspaceRole,
  target: WorkspaceRole,
): boolean {
  return hasAtLeastRole(actor, 'ADMIN') && RANK[actor] > RANK[target];
}

/** Whether `actor` may give someone `role`. You can only grant below your own rank. */
export function canAssignRole(
  actor: WorkspaceRole,
  role: WorkspaceRole,
): boolean {
  return hasAtLeastRole(actor, 'ADMIN') && RANK[actor] > RANK[role];
}

/** A workspace as seen by the current user (includes their role in it). */
export interface WorkspaceDto {
  id: string;
  name: string;
  role: WorkspaceRole;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

export interface MemberDto {
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  /** ISO 8601 timestamp. */
  joinedAt: string;
}

export interface CreateWorkspaceRequest {
  name: string;
}

export interface UpdateWorkspaceRequest {
  name: string;
}

export interface AddMemberRequest {
  email: string;
  role: AssignableWorkspaceRole;
}

export interface UpdateMemberRoleRequest {
  role: AssignableWorkspaceRole;
}
