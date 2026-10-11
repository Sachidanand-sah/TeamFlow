import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ActivityDto } from '@teamflow/shared';
import { Queue } from 'bullmq';
import { Subscription } from 'rxjs';
import { DomainEvent, DomainEvents } from '../../events/domain-events';
import {
  CommentAddedJob,
  NOTIFICATION_JOBS,
  NOTIFICATIONS_QUEUE,
  TaskAssignedJob,
} from '../../queue/queue.constants';
import { QUEUE_CALL_TIMEOUT_MS, withTimeout } from '../../queue/with-timeout';

export type PlannedNotification =
  | { name: typeof NOTIFICATION_JOBS.taskAssigned; data: TaskAssignedJob }
  | { name: typeof NOTIFICATION_JOBS.commentAdded; data: CommentAddedJob };

/**
 * Which recorded activities deserve an email. Pure, so the rules are easy to test.
 * Nobody is notified about their own actions.
 */
export function plannedNotification(
  workspaceId: string,
  activity: ActivityDto,
  actorId: string,
): PlannedNotification | null {
  if (!activity.taskId) return null;
  const base = { workspaceId, taskId: activity.taskId, actorId };

  switch (activity.type) {
    case 'TASK_CREATED':
    case 'TASK_UPDATED': {
      if (
        activity.type === 'TASK_UPDATED' &&
        !activity.data.fields.includes('assignee')
      ) {
        return null;
      }
      const assignee = activity.data.assignee;
      if (!assignee || assignee.userId === actorId) return null;
      return {
        name: NOTIFICATION_JOBS.taskAssigned,
        data: { ...base, assigneeUserId: assignee.userId },
      };
    }
    case 'COMMENT_ADDED':
      return {
        name: NOTIFICATION_JOBS.commentAdded,
        data: { ...base, commentId: activity.data.commentId },
      };
    default:
      return null;
  }
}

/**
 * Producer: turns recorded activity into queued notification jobs.
 *
 * WHY a queue instead of sending here: this runs right after a user's request.
 * SMTP can be slow or down; the queue makes sending asynchronous, retried with
 * backoff, and survivable across restarts (jobs live in Redis).
 */
@Injectable()
export class NotificationsListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsListener.name);
  private subscription?: Subscription;

  constructor(
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
    private readonly events: DomainEvents,
  ) {}

  onModuleInit(): void {
    this.subscription = this.events.events$.subscribe((e) => {
      void this.handle(e);
    });
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  async handle({ workspaceId, event }: DomainEvent): Promise<void> {
    if (event.type !== 'activity.recorded') return;
    const planned = plannedNotification(
      workspaceId,
      event.activity,
      event.actorId,
    );
    if (!planned) return;
    try {
      // Deterministic job id: the same activity can never be queued twice.
      await withTimeout(
        this.queue.add(planned.name, planned.data, {
          jobId: `${planned.name}_${event.activity.id}`,
        }),
        QUEUE_CALL_TIMEOUT_MS,
        'queue.add',
      );
    } catch (error) {
      // Redis down: log and move on. The user's change already succeeded.
      this.logger.warn(
        `Could not queue ${planned.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
