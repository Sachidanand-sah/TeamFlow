/** Queue names, shared by producers and processors. */
export const NOTIFICATIONS_QUEUE = 'notifications';
export const MAINTENANCE_QUEUE = 'maintenance';

/**
 * Notification jobs carry ids only; workers reload fresh data when they run, so an
 * email never contains stale or deleted content.
 */
export interface TaskAssignedJob {
  workspaceId: string;
  taskId: string;
  assigneeUserId: string;
  actorId: string;
}

/** Fan-out job: finds the recipients and enqueues one CommentEmailJob each. */
export interface CommentAddedJob {
  workspaceId: string;
  taskId: string;
  commentId: string;
  actorId: string;
}

/** Exactly one email, so a retry never re-sends to people who already got theirs. */
export interface CommentEmailJob extends CommentAddedJob {
  recipientUserId: string;
}

export const NOTIFICATION_JOBS = {
  taskAssigned: 'task-assigned',
  commentAdded: 'comment-added',
  commentEmail: 'comment-email',
} as const;

export const MAINTENANCE_CLEANUP_JOB = 'cleanup';
