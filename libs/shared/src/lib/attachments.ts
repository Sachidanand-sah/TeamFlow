/** Attachment contracts shared by apps/api and apps/web. */
import { TaskPersonDto } from './tasks';
import { hasAtLeastRole, WorkspaceRole } from './workspaces';

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const ATTACHMENT_FILE_NAME_MAX_LENGTH = 200;

/**
 * Allowlist, not blocklist: only types we know how to treat safely.
 * Deliberately absent: text/html, image/svg+xml, JavaScript. Those can run scripts
 * when a browser renders them, which would turn an upload into stored XSS.
 */
export const ALLOWED_ATTACHMENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const;
export type AllowedAttachmentType = (typeof ALLOWED_ATTACHMENT_TYPES)[number];

export function isAllowedAttachmentType(
  type: string,
): type is AllowedAttachmentType {
  return (ALLOWED_ATTACHMENT_TYPES as readonly string[]).includes(type);
}

/**
 * Display-safe file name: drops any path ("../../etc/passwd" -> "passwd"), control
 * characters and characters that break HTTP headers, and limits the length.
 * Falls back to "file" if nothing is left.
 */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f"<>|:*?]/g, '').trim();
  const limited = cleaned.slice(-ATTACHMENT_FILE_NAME_MAX_LENGTH);
  return limited.replace(/^\.+/, '') || 'file';
}

export interface AttachmentDto {
  id: string;
  taskId: string;
  fileName: string;
  contentType: string;
  size: number;
  uploader: TaskPersonDto | null;
  /** ISO 8601. */
  createdAt: string;
}

export interface CreateAttachmentRequest {
  fileName: string;
  contentType: AllowedAttachmentType;
  size: number;
}

/**
 * Where and how the browser uploads the file: a multipart POST of `fields` plus the
 * file (as the LAST field, named "file") to `url`. Storage itself enforces the size
 * and content type written into the signed policy.
 */
export interface PresignedUpload {
  url: string;
  fields: Record<string, string>;
}

export interface CreateAttachmentResponse {
  attachment: AttachmentDto;
  upload: PresignedUpload;
}

export interface AttachmentDownload {
  /** Short-lived signed URL; opening it downloads the file. */
  url: string;
}

/** Uploading is a write: MEMBER and above. */
export function canUploadAttachment(role: WorkspaceRole): boolean {
  return hasAtLeastRole(role, 'MEMBER');
}

/** The uploader removes their own file; admins remove any file. */
export function canDeleteAttachment(
  role: WorkspaceRole,
  isUploader: boolean,
): boolean {
  return (
    hasAtLeastRole(role, 'ADMIN') || (isUploader && canUploadAttachment(role))
  );
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
