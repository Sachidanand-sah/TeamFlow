import { Logger } from '@nestjs/common';
import { ActivityDto } from '@teamflow/shared';
import { Queue } from 'bullmq';
import { DomainEvents } from '../../events/domain-events';
import {
  NotificationsListener,
  plannedNotification,
} from './notifications.listener';

const WS = 'ws-1';
const base = {
  id: 'act-1',
  projectId: 'p-1',
  taskId: 't-1',
  taskKey: 'WEB-3',
  actor: { userId: 'ann', name: 'Ann' },
  createdAt: '2026-01-01T00:00:00.000Z',
};
const bob = { userId: 'bob', name: 'Bob' };

describe('plannedNotification', () => {
  it('emails the new assignee when a task is assigned', () => {
    const activity: ActivityDto = {
      ...base,
      type: 'TASK_UPDATED',
      data: { fields: ['assignee'], assignee: bob },
    };

    expect(plannedNotification(WS, activity, 'ann')).toEqual({
      name: 'task-assigned',
      data: {
        workspaceId: WS,
        taskId: 't-1',
        actorId: 'ann',
        assigneeUserId: 'bob',
      },
    });
  });

  it('emails the assignee of a task created already assigned', () => {
    const activity: ActivityDto = {
      ...base,
      type: 'TASK_CREATED',
      data: { title: 'X', assignee: bob },
    };

    expect(plannedNotification(WS, activity, 'ann')?.name).toBe(
      'task-assigned',
    );
  });

  it.each<[string, ActivityDto]>([
    [
      'self-assignment',
      {
        ...base,
        type: 'TASK_UPDATED',
        data: {
          fields: ['assignee'],
          assignee: { userId: 'ann', name: 'Ann' },
        },
      },
    ],
    [
      'unassignment',
      {
        ...base,
        type: 'TASK_UPDATED',
        data: { fields: ['assignee'], assignee: null },
      },
    ],
    [
      'other field changes',
      { ...base, type: 'TASK_UPDATED', data: { fields: ['title'] } },
    ],
    [
      'unassigned creation',
      { ...base, type: 'TASK_CREATED', data: { title: 'X' } },
    ],
    [
      'moves',
      { ...base, type: 'TASK_MOVED', data: { from: 'TODO', to: 'DONE' } },
    ],
    [
      'deleted tasks',
      { ...base, taskId: null, type: 'TASK_DELETED', data: { title: 'X' } },
    ],
  ])('sends nothing for %s', (_label, activity) => {
    expect(plannedNotification(WS, activity, 'ann')).toBeNull();
  });

  it('fans out comments', () => {
    const activity: ActivityDto = {
      ...base,
      type: 'COMMENT_ADDED',
      data: { commentId: 'c-1', excerpt: 'Hi' },
    };

    expect(plannedNotification(WS, activity, 'ann')).toEqual({
      name: 'comment-added',
      data: {
        workspaceId: WS,
        taskId: 't-1',
        actorId: 'ann',
        commentId: 'c-1',
      },
    });
  });
});

describe('NotificationsListener', () => {
  let queue: { add: jest.Mock };
  let listener: NotificationsListener;

  beforeEach(() => {
    queue = { add: jest.fn().mockResolvedValue({}) };
    listener = new NotificationsListener(
      queue as unknown as Queue,
      new DomainEvents(),
    );
  });

  const commentEvent = {
    workspaceId: WS,
    event: {
      type: 'activity.recorded' as const,
      projectId: 'p-1',
      actorId: 'ann',
      activity: {
        ...base,
        type: 'COMMENT_ADDED' as const,
        data: { commentId: 'c-1', excerpt: 'Hi' },
      },
    },
  };

  it('queues a job with a deterministic id (no duplicates)', async () => {
    await listener.handle(commentEvent);

    expect(queue.add).toHaveBeenCalledWith(
      'comment-added',
      { workspaceId: WS, taskId: 't-1', actorId: 'ann', commentId: 'c-1' },
      { jobId: 'comment-added_act-1' },
    );
  });

  it('ignores non-activity events', async () => {
    await listener.handle({
      workspaceId: WS,
      event: {
        type: 'task.deleted',
        taskId: 't-1',
        projectId: 'p-1',
        actorId: 'ann',
      },
    });

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('logs instead of throwing when Redis is unavailable', async () => {
    queue.add.mockRejectedValue(new Error('Connection is closed.'));
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    await expect(listener.handle(commentEvent)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
