import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WorkspaceRole } from '@teamflow/shared';
import { Membership, Prisma } from '../../generated/prisma/client';
import { ProjectsService } from '../projects/projects.service';
import { MembershipsRepository } from '../workspaces/memberships.repository';
import { WorkspaceMember } from '../workspaces/workspace-member';
import { TasksRepository, TaskWithRelations } from './tasks.repository';
import { TasksService } from './tasks.service';

const WS = 'ws-1';
const PROJECT = 'p-1';
const date = new Date('2026-05-01T00:00:00.000Z');

const member = (role: WorkspaceRole, userId = 'me'): WorkspaceMember => ({
  workspaceId: WS,
  userId,
  role,
});

function task(overrides: Partial<TaskWithRelations> = {}): TaskWithRelations {
  return {
    id: 't-1',
    workspaceId: WS,
    projectId: PROJECT,
    number: 7,
    title: 'Fix login',
    description: null,
    status: 'TODO',
    priority: 'MEDIUM',
    position: 0,
    assigneeMembershipId: null,
    reporterId: 'me',
    createdAt: date,
    updatedAt: date,
    project: { key: 'WEB' },
    assignee: null,
    reporter: { id: 'me', name: 'Me' },
    ...overrides,
  };
}

const bobMembership: Membership = {
  id: 'm-bob',
  workspaceId: WS,
  userId: 'bob',
  role: 'MEMBER',
  createdAt: date,
  updatedAt: date,
};

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('db error', {
    code,
    clientVersion: 'test',
  });

describe('TasksService', () => {
  let repo: jest.Mocked<
    Pick<
      TasksRepository,
      'list' | 'find' | 'create' | 'update' | 'move' | 'delete'
    >
  >;
  let projects: jest.Mocked<Pick<ProjectsService, 'get'>>;
  let memberships: jest.Mocked<Pick<MembershipsRepository, 'find'>>;
  let service: TasksService;

  beforeEach(() => {
    repo = {
      list: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      move: jest.fn(),
      delete: jest.fn(),
    };
    projects = { get: jest.fn() };
    memberships = { find: jest.fn() };
    service = new TasksService(
      repo as unknown as TasksRepository,
      projects as unknown as ProjectsService,
      memberships as unknown as MembershipsRepository,
    );
  });

  describe('list', () => {
    it('checks the project exists in the workspace, then returns its tasks', async () => {
      repo.list.mockResolvedValue([task()]);

      const result = await service.list(member('VIEWER'), PROJECT);

      expect(projects.get).toHaveBeenCalledWith(member('VIEWER'), PROJECT);
      expect(repo.list).toHaveBeenCalledWith(WS, PROJECT);
      expect(result[0]).toEqual({
        id: 't-1',
        projectId: PROJECT,
        number: 7,
        key: 'WEB-7',
        title: 'Fix login',
        description: null,
        status: 'TODO',
        priority: 'MEDIUM',
        position: 0,
        assignee: null,
        reporter: { userId: 'me', name: 'Me' },
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
      });
    });

    it('propagates 404 for a project outside the workspace', async () => {
      projects.get.mockRejectedValue(new NotFoundException());

      await expect(
        service.list(member('VIEWER'), 'other'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.list).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('returns 404 when the task is not in this project', async () => {
      repo.find.mockResolvedValue(null);

      await expect(
        service.get(member('VIEWER'), PROJECT, 't-x'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.find).toHaveBeenCalledWith(WS, PROJECT, 't-x');
    });
  });

  describe('create', () => {
    it('creates with defaults and the caller as reporter', async () => {
      repo.create.mockResolvedValue(task());

      await service.create(member('MEMBER'), PROJECT, {
        title: '  Fix login ',
      });

      expect(repo.create).toHaveBeenCalledWith(WS, PROJECT, {
        title: 'Fix login',
        description: null,
        status: 'TODO',
        priority: 'MEDIUM',
        assigneeMembershipId: null,
        reporterId: 'me',
      });
    });

    it('resolves the assignee to their membership in this workspace', async () => {
      memberships.find.mockResolvedValue(bobMembership);
      repo.create.mockResolvedValue(task());

      await service.create(member('MEMBER'), PROJECT, {
        title: 'X',
        assigneeId: 'bob',
      });

      expect(memberships.find).toHaveBeenCalledWith(WS, 'bob');
      expect(repo.create.mock.calls[0][2].assigneeMembershipId).toBe('m-bob');
    });

    it('rejects an assignee who is not a member of this workspace', async () => {
      memberships.find.mockResolvedValue(null);

      await expect(
        service.create(member('MEMBER'), PROJECT, {
          title: 'X',
          assigneeId: 'stranger',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('returns 404 when the project is not in this workspace', async () => {
      repo.create.mockRejectedValue(prismaError('P2025'));

      await expect(
        service.create(member('MEMBER'), 'other', { title: 'X' }),
      ).rejects.toThrow(new NotFoundException('Project not found'));
    });
  });

  describe('update', () => {
    it('only sends provided fields', async () => {
      repo.update.mockResolvedValue(task());

      await service.update(member('MEMBER'), PROJECT, 't-1', {
        title: ' New ',
        priority: 'HIGH',
      });

      expect(repo.update).toHaveBeenCalledWith(WS, PROJECT, 't-1', {
        title: 'New',
        priority: 'HIGH',
      });
      expect(memberships.find).not.toHaveBeenCalled();
    });

    it('unassigns with null without a membership lookup', async () => {
      repo.update.mockResolvedValue(task());

      await service.update(member('MEMBER'), PROJECT, 't-1', {
        assigneeId: null,
      });

      expect(repo.update).toHaveBeenCalledWith(WS, PROJECT, 't-1', {
        assigneeMembershipId: null,
      });
      expect(memberships.find).not.toHaveBeenCalled();
    });

    it('maps the assignee name into the response', async () => {
      memberships.find.mockResolvedValue(bobMembership);
      repo.update.mockResolvedValue(
        task({
          assigneeMembershipId: 'm-bob',
          assignee: { user: { id: 'bob', name: 'Bob' } },
        }),
      );

      const result = await service.update(member('MEMBER'), PROJECT, 't-1', {
        assigneeId: 'bob',
      });

      expect(result.assignee).toEqual({ userId: 'bob', name: 'Bob' });
    });

    it('returns 404 for a task outside this project', async () => {
      repo.update.mockRejectedValue(prismaError('P2025'));

      await expect(
        service.update(member('MEMBER'), PROJECT, 't-x', { title: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('move', () => {
    it('moves inside the verified workspace and project', async () => {
      repo.move.mockResolvedValue(task({ status: 'DONE', position: 2 }));

      const result = await service.move(member('MEMBER'), PROJECT, 't-1', {
        status: 'DONE',
        index: 2,
      });

      expect(repo.move).toHaveBeenCalledWith(WS, PROJECT, 't-1', 'DONE', 2);
      expect(result.status).toBe('DONE');
    });

    it('returns 404 when the task or project is not found', async () => {
      repo.move.mockResolvedValue(null);

      await expect(
        service.move(member('MEMBER'), PROJECT, 't-x', {
          status: 'DONE',
          index: 0,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('delete', () => {
    it('lets the reporter delete their own task', async () => {
      repo.find.mockResolvedValue(task({ reporterId: 'me' }));

      await service.delete(member('MEMBER'), PROJECT, 't-1');

      expect(repo.delete).toHaveBeenCalledWith(WS, PROJECT, 't-1');
    });

    it("forbids a MEMBER from deleting someone else's task", async () => {
      repo.find.mockResolvedValue(task({ reporterId: 'bob' }));

      await expect(
        service.delete(member('MEMBER'), PROJECT, 't-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('lets an ADMIN delete any task', async () => {
      repo.find.mockResolvedValue(task({ reporterId: 'bob' }));

      await service.delete(member('ADMIN'), PROJECT, 't-1');

      expect(repo.delete).toHaveBeenCalled();
    });

    it('returns 404 for an unknown task', async () => {
      repo.find.mockResolvedValue(null);

      await expect(
        service.delete(member('ADMIN'), PROJECT, 't-x'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
