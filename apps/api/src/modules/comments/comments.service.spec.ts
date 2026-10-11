import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TaskDto, WorkspaceRole } from '@teamflow/shared';
import { DomainEvents } from '../../events/domain-events';
import { Prisma } from '../../generated/prisma/client';
import { ActivityService } from '../activity/activity.service';
import { TasksService } from '../tasks/tasks.service';
import { WorkspaceMember } from '../workspaces/workspace-member';
import { CommentsRepository, CommentWithAuthor } from './comments.repository';
import { CommentsService } from './comments.service';

const WS = 'ws-1';
const P = 'p-1';
const T = 't-1';
const date = new Date('2026-06-01T00:00:00.000Z');

const member = (role: WorkspaceRole, userId = 'me'): WorkspaceMember => ({
  workspaceId: WS,
  userId,
  role,
});

function comment(
  overrides: Partial<CommentWithAuthor> = {},
): CommentWithAuthor {
  return {
    id: 'c-1',
    workspaceId: WS,
    taskId: T,
    authorId: 'me',
    body: 'Looks good',
    editedAt: null,
    createdAt: date,
    author: { id: 'me', name: 'Me' },
    ...overrides,
  };
}

describe('CommentsService', () => {
  let repo: jest.Mocked<
    Pick<
      CommentsRepository,
      'list' | 'find' | 'create' | 'updateBody' | 'delete'
    >
  >;
  let tasks: jest.Mocked<Pick<TasksService, 'get'>>;
  let activity: jest.Mocked<Pick<ActivityService, 'record'>>;
  let events: jest.Mocked<Pick<DomainEvents, 'publish'>>;
  let service: CommentsService;

  beforeEach(() => {
    repo = {
      list: jest.fn(),
      find: jest.fn().mockResolvedValue(comment()),
      create: jest.fn(),
      updateBody: jest.fn(),
      delete: jest.fn(),
    };
    tasks = {
      get: jest.fn().mockResolvedValue({ id: T, key: 'WEB-3' } as TaskDto),
    };
    activity = { record: jest.fn() };
    events = { publish: jest.fn() };
    service = new CommentsService(
      repo as unknown as CommentsRepository,
      tasks as unknown as TasksService,
      activity as unknown as ActivityService,
      events as unknown as DomainEvents,
    );
  });

  const published = () => events.publish.mock.calls.map(([e]) => e.event.type);

  describe('list', () => {
    it('checks the task is in this project/workspace, then lists oldest first', async () => {
      repo.list.mockResolvedValue([comment()]);

      const result = await service.list(member('VIEWER'), P, T);

      expect(tasks.get).toHaveBeenCalledWith(member('VIEWER'), P, T);
      expect(repo.list).toHaveBeenCalledWith(WS, T);
      expect(result).toEqual([
        {
          id: 'c-1',
          taskId: T,
          author: { userId: 'me', name: 'Me' },
          body: 'Looks good',
          editedAt: null,
          createdAt: '2026-06-01T00:00:00.000Z',
        },
      ]);
    });

    it('404s when the task is elsewhere', async () => {
      tasks.get.mockRejectedValue(new NotFoundException());

      await expect(
        service.list(member('VIEWER'), P, 'x'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.list).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('saves, publishes and records COMMENT_ADDED with an excerpt', async () => {
      const long = 'word '.repeat(60);
      repo.create.mockResolvedValue(comment({ body: long.trim() }));

      await service.create(member('MEMBER'), P, T, `  ${long} `);

      expect(repo.create).toHaveBeenCalledWith(WS, T, 'me', long.trim());
      expect(published()).toEqual(['comment.upserted']);
      const recorded = activity.record.mock.calls[0][0];
      expect(recorded).toMatchObject({
        workspaceId: WS,
        projectId: P,
        taskId: T,
        taskKey: 'WEB-3',
        actorId: 'me',
        type: 'COMMENT_ADDED',
      });
      const data = recorded.data as { excerpt: string; commentId: string };
      expect(data.commentId).toBe('c-1');
      expect(data.excerpt.length).toBeLessThanOrEqual(140);
      expect(data.excerpt.endsWith('…')).toBe(true);
    });
  });

  describe('update', () => {
    it('lets the author edit', async () => {
      repo.updateBody.mockResolvedValue(
        comment({ body: 'Edited', editedAt: date }),
      );

      const result = await service.update(
        member('MEMBER'),
        P,
        T,
        'c-1',
        ' Edited ',
      );

      expect(repo.updateBody).toHaveBeenCalledWith(WS, T, 'c-1', 'Edited');
      expect(result.editedAt).toBe('2026-06-01T00:00:00.000Z');
      expect(published()).toEqual(['comment.upserted']);
    });

    it("forbids editing someone else's comment, even for admins", async () => {
      repo.find.mockResolvedValue(comment({ authorId: 'bob' }));

      await expect(
        service.update(member('ADMIN'), P, T, 'c-1', 'X'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.updateBody).not.toHaveBeenCalled();
    });

    it('404s for a comment on another task', async () => {
      repo.find.mockResolvedValue(null);

      await expect(
        service.update(member('MEMBER'), P, T, 'c-x', 'X'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('delete', () => {
    it('lets the author delete and publishes the removal', async () => {
      await service.delete(member('MEMBER'), P, T, 'c-1');

      expect(repo.delete).toHaveBeenCalledWith(WS, T, 'c-1');
      expect(published()).toEqual(['comment.deleted']);
    });

    it("lets an admin delete anyone's comment", async () => {
      repo.find.mockResolvedValue(comment({ authorId: 'bob' }));

      await service.delete(member('ADMIN'), P, T, 'c-1');

      expect(repo.delete).toHaveBeenCalled();
    });

    it("forbids a MEMBER from deleting someone else's comment", async () => {
      repo.find.mockResolvedValue(comment({ authorId: 'bob' }));

      await expect(
        service.delete(member('MEMBER'), P, T, 'c-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(events.publish).not.toHaveBeenCalled();
    });

    it('maps a concurrent deletion to 404', async () => {
      repo.delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('gone', {
          code: 'P2025',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.delete(member('MEMBER'), P, T, 'c-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
