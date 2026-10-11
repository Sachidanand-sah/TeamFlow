/** Comment contracts shared by apps/api and apps/web. */
import { TaskPersonDto } from './tasks';
import { hasAtLeastRole, WorkspaceRole } from './workspaces';

export const COMMENT_MAX_LENGTH = 5000;

export interface CommentDto {
  id: string;
  taskId: string;
  /** null if the author's account was deleted. */
  author: TaskPersonDto | null;
  body: string;
  /** ISO 8601; null if never edited. */
  editedAt: string | null;
  createdAt: string;
}

export interface CreateCommentRequest {
  body: string;
}

export interface UpdateCommentRequest {
  body: string;
}

/** Commenting needs MEMBER (VIEWER is read-only everywhere). */
export function canComment(role: WorkspaceRole): boolean {
  return hasAtLeastRole(role, 'MEMBER');
}

/** Only the author edits a comment: nobody should put words in someone's mouth. */
export function canEditComment(
  role: WorkspaceRole,
  isAuthor: boolean,
): boolean {
  return isAuthor && canComment(role);
}

/** The author removes their own comment; admins moderate any comment. */
export function canDeleteComment(
  role: WorkspaceRole,
  isAuthor: boolean,
): boolean {
  return hasAtLeastRole(role, 'ADMIN') || canEditComment(role, isAuthor);
}
