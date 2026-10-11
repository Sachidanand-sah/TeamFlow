import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import { EnvironmentVariables } from '../../config/env.validation';
import {
  commentAddedEmail,
  taskAssignedEmail,
} from '../../mail/email-templates';
import { MailerService } from '../../mail/mailer.service';
import {
  CommentAddedJob,
  CommentEmailJob,
  NOTIFICATION_JOBS,
  NOTIFICATIONS_QUEUE,
  TaskAssignedJob,
} from '../../queue/queue.constants';
import {
  NotificationsRepository,
  NotificationTask,
} from './notifications.repository';

const EXCERPT_LENGTH = 500;

/**
 * Worker: turns notification jobs into emails.
 *
 * Every job re-checks the current state (task still exists, recipient still a
 * member, still the assignee) because time passes between enqueue and run.
 * Returning normally = done. Throwing = BullMQ retries with backoff.
 */
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);
  private readonly appUrl: string;

  constructor(
    private readonly repo: NotificationsRepository,
    private readonly mailer: MailerService,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    super();
    this.appUrl = config.get('APP_URL', { infer: true }).replace(/\/$/, '');
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case NOTIFICATION_JOBS.taskAssigned:
        return this.taskAssigned(job.data as TaskAssignedJob);
      case NOTIFICATION_JOBS.commentAdded:
        return this.commentAdded(job.data as CommentAddedJob, job.id ?? '');
      case NOTIFICATION_JOBS.commentEmail:
        return this.commentEmail(job.data as CommentEmailJob);
      default:
        this.logger.warn(`Unknown notification job "${job.name}" ignored`);
    }
  }

  async taskAssigned(data: TaskAssignedJob): Promise<void> {
    const task = await this.repo.findTask(data.workspaceId, data.taskId);
    // Deleted, or reassigned again before we ran: nothing to say.
    if (!task || task.assigneeUserId !== data.assigneeUserId) return;
    const recipient = await this.repo.findMember(
      data.workspaceId,
      data.assigneeUserId,
    );
    if (!recipient) return;

    await this.mailer.send(
      taskAssignedEmail({
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        actorName: (await this.repo.findUserName(data.actorId)) ?? 'Someone',
        taskKey: task.key,
        taskTitle: task.title,
        boardUrl: this.boardUrl(data.workspaceId, task),
      }),
    );
  }

  /** Fan-out: one email job per recipient (reporter and assignee, never the author). */
  async commentAdded(data: CommentAddedJob, jobId: string): Promise<void> {
    const task = await this.repo.findTask(data.workspaceId, data.taskId);
    if (!task) return;
    const recipients = [
      ...new Set([task.reporterId, task.assigneeUserId]),
    ].filter((id): id is string => id !== null && id !== data.actorId);
    if (recipients.length === 0) return;

    await this.queue.addBulk(
      recipients.map((recipientUserId) => ({
        name: NOTIFICATION_JOBS.commentEmail,
        data: { ...data, recipientUserId },
        // Stable ids: if this fan-out job is retried, nobody is queued twice.
        opts: { jobId: `${jobId}_${recipientUserId}` },
      })),
    );
  }

  async commentEmail(data: CommentEmailJob): Promise<void> {
    const task = await this.repo.findTask(data.workspaceId, data.taskId);
    const comment = await this.repo.findComment(
      data.workspaceId,
      data.taskId,
      data.commentId,
    );
    if (!task || !comment) return; // deleted in the meantime
    const recipient = await this.repo.findMember(
      data.workspaceId,
      data.recipientUserId,
    );
    if (!recipient) return;

    const flat = comment.body.replace(/\s+/g, ' ').trim();
    await this.mailer.send(
      commentAddedEmail({
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        actorName: (await this.repo.findUserName(data.actorId)) ?? 'Someone',
        taskKey: task.key,
        taskTitle: task.title,
        boardUrl: this.boardUrl(data.workspaceId, task),
        commentExcerpt:
          flat.length > EXCERPT_LENGTH
            ? `${flat.slice(0, EXCERPT_LENGTH - 1)}…`
            : flat,
      }),
    );
  }

  private boardUrl(workspaceId: string, task: NotificationTask): string {
    return `${this.appUrl}/workspaces/${workspaceId}/projects/${task.projectId}`;
  }
}
