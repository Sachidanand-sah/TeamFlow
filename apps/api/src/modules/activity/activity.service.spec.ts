import { Logger, NotFoundException } from '@nestjs/common';
import { ACTIVITY_PAGE_SIZE } from '@teamflow/shared';
import { DomainEvents } from '../../events/domain-events';
import { ProjectsService } from '../projects/projects.service';
import { WorkspaceMember } from '../workspaces/workspace-member';
import { ActivityRepository, ActivityWithActor } from './activity.repository';
import { ActivityService, toActivityDto } from './activity.service';

const member: WorkspaceMember = {
  workspaceId: 'ws-1',
  userId: 'me',
  role: 'VIEWER',
};

function row(id: string): ActivityWithActor {
  return {
    id,
    workspaceId: 'ws-1',
    projectId: 'p-1',
    taskId: 't-1',
    taskKey: 'WEB-3',
    actorId: 'me',
    type: 'TASK_MOVED',
    data: { from: 'TODO', to: 'DONE' },
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    actor: { id: 'me', name: 'Me' },
  };
}

describe('ActivityService', () => {
  let repo: jest.Mocked<Pick<ActivityRepository, 'create' | 'list'>>;
  let projects: jest.Mocked<Pick<ProjectsService, 'get'>>;
  let events: DomainEvents;
  let service: ActivityService;

  beforeEach(() => {
    repo = { create: jest.fn(), list: jest.fn() };
    projects = { get: jest.fn() };
    events = new DomainEvents();
    service = new ActivityService(
      repo as unknown as ActivityRepository,
      projects as unknown as ProjectsService,
      events,
    );
  });

  describe('record', () => {
    const input = {
      workspaceId: 'ws-1',
      projectId: 'p-1',
      taskId: 't-1',
      taskKey: 'WEB-3',
      actorId: 'me',
      type: 'TASK_MOVED' as const,
      data: { from: 'TODO' as const, to: 'DONE' as const },
    };

    it('saves the entry and publishes it on the event bus', async () => {
      repo.create.mockResolvedValue(row('a-1'));
      const seen: unknown[] = [];
      events.events$.subscribe((e) => seen.push(e));

      await service.record(input);

      expect(repo.create).toHaveBeenCalledWith(input);
      expect(seen).toEqual([
        {
          workspaceId: 'ws-1',
          event: {
            type: 'activity.recorded',
            projectId: 'p-1',
            actorId: 'me',
            activity: toActivityDto(row('a-1')),
          },
        },
      ]);
    });

    it('logs instead of throwing when saving fails', async () => {
      repo.create.mockRejectedValue(new Error('db down'));
      const logged = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);

      await expect(service.record(input)).resolves.toBeUndefined();
      expect(logged).toHaveBeenCalled();
      logged.mockRestore();
    });
  });

  describe('list', () => {
    it('returns a page and a cursor when more entries exist', async () => {
      const rows = Array.from({ length: ACTIVITY_PAGE_SIZE + 1 }, (_, i) =>
        row(`a-${i}`),
      );
      repo.list.mockResolvedValue(rows);

      const page = await service.list(member, 'p-1', {});

      expect(projects.get).toHaveBeenCalledWith(member, 'p-1');
      expect(repo.list).toHaveBeenCalledWith('ws-1', 'p-1', {
        take: ACTIVITY_PAGE_SIZE + 1,
      });
      expect(page.items).toHaveLength(ACTIVITY_PAGE_SIZE);
      expect(page.nextCursor).toBe(`a-${ACTIVITY_PAGE_SIZE - 1}`);
    });

    it('returns no cursor on the last page and passes filters through', async () => {
      repo.list.mockResolvedValue([row('a-1')]);

      const page = await service.list(member, 'p-1', {
        taskId: 't-1',
        cursor: 'a-0',
      });

      expect(repo.list).toHaveBeenCalledWith('ws-1', 'p-1', {
        taskId: 't-1',
        cursor: 'a-0',
        take: ACTIVITY_PAGE_SIZE + 1,
      });
      expect(page.nextCursor).toBeNull();
      expect(page.items[0]).toMatchObject({
        type: 'TASK_MOVED',
        data: { from: 'TODO', to: 'DONE' },
        actor: { userId: 'me', name: 'Me' },
      });
    });

    it('404s for a project outside the workspace', async () => {
      projects.get.mockRejectedValue(new NotFoundException());

      await expect(service.list(member, 'other', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.list).not.toHaveBeenCalled();
    });
  });
});
