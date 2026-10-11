import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import { EnvironmentVariables } from '../../config/env.validation';
import { MailerService } from '../../mail/mailer.service';
import { NotificationsProcessor } from './notifications.processor';
import {
  NotificationsRepository,
  NotificationTask,
} from './notifications.repository';

const WS = 'ws-1';
const task: NotificationTask = {
  id: 't-1',
  projectId: 'p-1',
  key: 'WEB-3',
  title: 'Fix login',
  reporterId: 'ann',
  assigneeUserId: 'bob',
};
const member = (userId: string) => ({
  userId,
  email: `${userId}@example.com`,
  name: userId.toUpperCase(),
});

describe('NotificationsProcessor', () => {
  let repo: jest.Mocked<
    Pick<
      NotificationsRepository,
      'findTask' | 'findMember' | 'findUserName' | 'findComment'
    >
  >;
  let mailer: { send: jest.Mock };
  let queue: { addBulk: jest.Mock };
  let processor: NotificationsProcessor;

  beforeEach(() => {
    repo = {
      findTask: jest.fn().mockResolvedValue(task),
      findMember: jest
        .fn()
        .mockImplementation((_ws: string, id: string) =>
          Promise.resolve(member(id)),
        ),
      findUserName: jest.fn().mockResolvedValue('Carol'),
      findComment: jest.fn().mockResolvedValue({ body: 'Looks good' }),
    };
    mailer = { send: jest.fn().mockResolvedValue(undefined) };
    queue = { addBulk: jest.fn().mockResolvedValue([]) };
    const config = {
      get: jest.fn().mockReturnValue('http://app.example.com/'),
    } as unknown as ConfigService<EnvironmentVariables, true>;
    processor = new NotificationsProcessor(
      repo as unknown as NotificationsRepository,
      mailer as unknown as MailerService,
      queue as unknown as Queue,
      config,
    );
  });

  const job = (name: string, data: object, id = 'job-1') =>
    ({ name, data, id }) as unknown as Job;

  describe('task-assigned', () => {
    const data = {
      workspaceId: WS,
      taskId: 't-1',
      assigneeUserId: 'bob',
      actorId: 'carol',
    };

    it('emails the assignee with a link to the board', async () => {
      await processor.process(job('task-assigned', data));

      expect(repo.findMember).toHaveBeenCalledWith(WS, 'bob');
      const email = mailer.send.mock.calls[0][0];
      expect(email.to).toBe('bob@example.com');
      expect(email.subject).toContain('[WEB-3]');
      expect(email.text).toContain('Carol assigned WEB-3');
      expect(email.text).toContain(
        'http://app.example.com/workspaces/ws-1/projects/p-1',
      );
    });

    it('skips when the task was reassigned meanwhile', async () => {
      repo.findTask.mockResolvedValue({ ...task, assigneeUserId: 'dave' });

      await processor.process(job('task-assigned', data));

      expect(mailer.send).not.toHaveBeenCalled();
    });

    it('skips when the task was deleted', async () => {
      repo.findTask.mockResolvedValue(null);

      await processor.process(job('task-assigned', data));

      expect(mailer.send).not.toHaveBeenCalled();
    });

    it('skips recipients who left the workspace', async () => {
      repo.findMember.mockResolvedValue(null);

      await processor.process(job('task-assigned', data));

      expect(mailer.send).not.toHaveBeenCalled();
    });

    it('lets SMTP failures propagate so BullMQ retries', async () => {
      mailer.send.mockRejectedValue(new Error('SMTP down'));

      await expect(
        processor.process(job('task-assigned', data)),
      ).rejects.toThrow('SMTP down');
    });
  });

  describe('comment-added (fan-out)', () => {
    const data = {
      workspaceId: WS,
      taskId: 't-1',
      commentId: 'c-1',
      actorId: 'carol',
    };

    it('queues one email per reporter/assignee with stable ids', async () => {
      await processor.process(
        job('comment-added', data, 'comment-added_act-1'),
      );

      expect(queue.addBulk).toHaveBeenCalledWith([
        {
          name: 'comment-email',
          data: { ...data, recipientUserId: 'ann' },
          opts: { jobId: 'comment-added_act-1_ann' },
        },
        {
          name: 'comment-email',
          data: { ...data, recipientUserId: 'bob' },
          opts: { jobId: 'comment-added_act-1_bob' },
        },
      ]);
    });

    it('never notifies the comment author and dedupes people', async () => {
      repo.findTask.mockResolvedValue({
        ...task,
        reporterId: 'carol',
        assigneeUserId: 'carol',
      });

      await processor.process(job('comment-added', data));

      expect(queue.addBulk).not.toHaveBeenCalled();
    });
  });

  describe('comment-email', () => {
    const data = {
      workspaceId: WS,
      taskId: 't-1',
      commentId: 'c-1',
      actorId: 'carol',
      recipientUserId: 'bob',
    };

    it('emails one recipient with the comment excerpt', async () => {
      await processor.process(job('comment-email', data));

      const email = mailer.send.mock.calls[0][0];
      expect(email.to).toBe('bob@example.com');
      expect(email.text).toContain('Looks good');
    });

    it('skips a deleted comment', async () => {
      repo.findComment.mockResolvedValue(null);

      await processor.process(job('comment-email', data));

      expect(mailer.send).not.toHaveBeenCalled();
    });
  });
});
