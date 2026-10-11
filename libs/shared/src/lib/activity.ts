/** Activity log contracts shared by apps/api and apps/web. */
import { TASK_STATUS_LABELS, TaskPersonDto, TaskStatus } from './tasks';

/** Which task fields an update touched (for "Ann changed the priority of WEB-3"). */
export const TRACKED_TASK_FIELDS = [
  'title',
  'description',
  'priority',
  'assignee',
] as const;
export type TrackedTaskField = (typeof TRACKED_TASK_FIELDS)[number];

/** Type-specific payloads. Must match the Prisma `ActivityType` enum. */
export interface ActivityDataByType {
  TASK_CREATED: {
    title: string;
    /** Set when the task was created already assigned. */
    assignee?: TaskPersonDto | null;
  };
  TASK_UPDATED: {
    fields: TrackedTaskField[];
    /** Set when the assignee changed; null = unassigned. */
    assignee?: TaskPersonDto | null;
  };
  TASK_MOVED: { from: TaskStatus; to: TaskStatus };
  TASK_DELETED: { title: string };
  COMMENT_ADDED: { commentId: string; excerpt: string };
}

export type ActivityType = keyof ActivityDataByType;

interface ActivityBase {
  id: string;
  projectId: string;
  /** null once the task is deleted. */
  taskId: string | null;
  /** e.g. "WEB-3", kept even after the task is deleted. */
  taskKey: string;
  /** null if the actor's account was deleted. */
  actor: TaskPersonDto | null;
  /** ISO 8601. */
  createdAt: string;
}

/**
 * Discriminated union: checking `type` tells TypeScript the exact shape of `data`,
 * so the UI can never read `data.from` on a comment entry by mistake.
 */
export type ActivityDto = {
  [K in ActivityType]: ActivityBase & { type: K; data: ActivityDataByType[K] };
}[ActivityType];

export interface ActivityPage {
  items: ActivityDto[];
  /** Pass as `?cursor=` to get the next (older) page; null when there is none. */
  nextCursor: string | null;
}

export const ACTIVITY_PAGE_SIZE = 30;

const FIELD_LABELS: Record<TrackedTaskField, string> = {
  title: 'title',
  description: 'description',
  priority: 'priority',
  assignee: 'assignee',
};

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) {
    return labels.join('');
  }
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

/** Human sentence without the actor, e.g. "moved WEB-3 from To do to Done". */
export function describeActivity(activity: ActivityDto): string {
  const key = activity.taskKey;
  switch (activity.type) {
    case 'TASK_CREATED':
      return `created ${key} "${activity.data.title}"`;
    case 'TASK_DELETED':
      return `deleted ${key} "${activity.data.title}"`;
    case 'TASK_MOVED':
      return `moved ${key} from ${TASK_STATUS_LABELS[activity.data.from]} to ${TASK_STATUS_LABELS[activity.data.to]}`;
    case 'COMMENT_ADDED':
      return `commented on ${key}`;
    case 'TASK_UPDATED': {
      const { fields, assignee } = activity.data;
      if (fields.length === 1 && fields[0] === 'assignee') {
        return assignee
          ? `assigned ${key} to ${assignee.name}`
          : `unassigned ${key}`;
      }
      return `changed the ${joinLabels(fields.map((f) => FIELD_LABELS[f]))} of ${key}`;
    }
  }
}
