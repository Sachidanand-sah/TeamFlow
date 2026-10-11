/** Task contracts and board rules shared by apps/api and apps/web. */
import { hasAtLeastRole, WorkspaceRole } from './workspaces';

/** Kanban columns in board order. Must match the Prisma `TaskStatus` enum. */
export const TASK_STATUSES = [
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'DONE',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'In review',
  DONE: 'Done',
};

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_TITLE_MAX_LENGTH = 200;
export const TASK_DESCRIPTION_MAX_LENGTH = 10_000;

export interface TaskPersonDto {
  userId: string;
  name: string;
}

export interface TaskDto {
  id: string;
  projectId: string;
  number: number;
  /** "<project key>-<number>", e.g. "WEB-12". */
  key: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  /** Order inside its status column, 0 = top. */
  position: number;
  assignee: TaskPersonDto | null;
  reporter: TaskPersonDto | null;
  /** ISO 8601 timestamps. */
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  /** userId of a workspace member. */
  assigneeId?: string | null;
}

/** Partial update. Status/order change through the move endpoint instead. */
export interface UpdateTaskRequest {
  title?: string;
  /** `null` clears it. */
  description?: string | null;
  priority?: TaskPriority;
  /** userId of a workspace member, or `null` to unassign. */
  assigneeId?: string | null;
}

/** Put the task in `status` at `index` (0 = top), as after a drag-and-drop. */
export interface MoveTaskRequest {
  status: TaskStatus;
  index: number;
}

/** MEMBER and above may create, edit and move tasks; VIEWER is read-only. */
export function canEditTasks(role: WorkspaceRole): boolean {
  return hasAtLeastRole(role, 'MEMBER');
}

/** The reporter may delete their own task; admins may delete any task. */
export function canDeleteTask(
  role: WorkspaceRole,
  isReporter: boolean,
): boolean {
  return (
    hasAtLeastRole(role, 'ADMIN') ||
    (isReporter && hasAtLeastRole(role, 'MEMBER'))
  );
}

export function formatTaskKey(projectKey: string, number: number): string {
  return `${projectKey}-${number}`;
}

/** Minimal shape `moveTask` needs, so the API can use it on database rows too. */
export interface Positioned {
  id: string;
  status: TaskStatus;
  position: number;
}

/**
 * Returns the tasks after moving `taskId` to `status` at `index`, with `position`
 * renumbered 0..n-1 in every column the move touched. Pure: does not mutate input.
 *
 * WHY one shared function: the board applies it instantly (optimistic UI) and the API
 * applies it in the database, so both sides agree on the resulting order.
 */
export function moveTask<T extends Positioned>(
  tasks: readonly T[],
  taskId: string,
  status: TaskStatus,
  index: number,
): T[] {
  const moving = tasks.find((t) => t.id === taskId);
  if (!moving) {
    return [...tasks];
  }

  const column = (s: TaskStatus) =>
    tasks
      .filter((t) => t.status === s && t.id !== taskId)
      .sort((a, b) => a.position - b.position);

  const target = column(status);
  const clamped = Math.max(0, Math.min(index, target.length));
  target.splice(clamped, 0, { ...moving, status });

  const renumbered = new Map<string, T>();
  target.forEach((t, i) => renumbered.set(t.id, { ...t, position: i }));
  if (moving.status !== status) {
    column(moving.status).forEach((t, i) =>
      renumbered.set(t.id, { ...t, position: i }),
    );
  }

  return tasks.map((t) => renumbered.get(t.id) ?? t);
}
