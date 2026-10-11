import { WorkspaceRole } from '@teamflow/shared';
import { AuthenticatedRequest } from '../auth/auth.types';

/**
 * The caller's verified membership in the workspace named in the URL.
 * Produced by WorkspaceRoleGuard from the database, never from client input, so
 * services can trust `workspaceId` and `role` in it.
 */
export interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}

export interface WorkspaceRequest extends AuthenticatedRequest {
  workspaceMember?: WorkspaceMember;
}
