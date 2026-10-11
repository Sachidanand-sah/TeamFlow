import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, Project } from '../../generated/prisma/client';
import { WorkspaceMember } from '../workspaces/workspace-member';
import { ProjectsRepository } from './projects.repository';
import { ProjectsService } from './projects.service';

const member: WorkspaceMember = {
  workspaceId: 'ws-1',
  userId: 'user-1',
  role: 'ADMIN',
};

const project: Project = {
  id: 'p-1',
  workspaceId: 'ws-1',
  key: 'WEB',
  name: 'Website',
  description: null,
  taskCounter: 0,
  createdAt: new Date('2026-04-01T00:00:00.000Z'),
  updatedAt: new Date('2026-04-02T00:00:00.000Z'),
};

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('db error', {
    code,
    clientVersion: 'test',
  });

describe('ProjectsService', () => {
  let repo: jest.Mocked<
    Pick<ProjectsRepository, 'list' | 'find' | 'create' | 'update' | 'delete'>
  >;
  let service: ProjectsService;

  beforeEach(() => {
    repo = {
      list: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    service = new ProjectsService(repo as unknown as ProjectsRepository);
  });

  describe('list', () => {
    it("lists only the member's workspace", async () => {
      repo.list.mockResolvedValue([project]);

      const result = await service.list(member);

      expect(repo.list).toHaveBeenCalledWith('ws-1');
      expect(result).toEqual([
        {
          id: 'p-1',
          workspaceId: 'ws-1',
          key: 'WEB',
          name: 'Website',
          description: null,
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-02T00:00:00.000Z',
        },
      ]);
    });
  });

  describe('get', () => {
    it('looks the project up inside the verified workspace', async () => {
      repo.find.mockResolvedValue(project);

      await service.get(member, 'p-1');

      expect(repo.find).toHaveBeenCalledWith('ws-1', 'p-1');
    });

    it('returns 404 for a project in another workspace (or none)', async () => {
      repo.find.mockResolvedValue(null);

      await expect(service.get(member, 'p-other')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates the project in the verified workspace', async () => {
      repo.create.mockResolvedValue(project);

      await service.create(member, {
        name: ' Website ',
        key: 'WEB',
        description: '  ',
      });

      expect(repo.create).toHaveBeenCalledWith('ws-1', {
        key: 'WEB',
        name: 'Website',
        description: null,
      });
    });

    it('keeps a real description, trimmed', async () => {
      repo.create.mockResolvedValue(project);

      await service.create(member, {
        name: 'Website',
        key: 'WEB',
        description: ' Marketing site ',
      });

      expect(repo.create.mock.calls[0][1].description).toBe('Marketing site');
    });

    it('returns 409 when the key is taken in this workspace', async () => {
      repo.create.mockRejectedValue(prismaError('P2002'));

      await expect(
        service.create(member, { name: 'Website', key: 'WEB' }),
      ).rejects.toThrow(
        new ConflictException(
          'A project with key WEB already exists in this workspace',
        ),
      );
    });
  });

  describe('update', () => {
    it('only sends the fields that were provided', async () => {
      repo.update.mockResolvedValue(project);

      await service.update(member, 'p-1', { name: ' New name ' });

      expect(repo.update).toHaveBeenCalledWith('ws-1', 'p-1', {
        name: 'New name',
      });
    });

    it('clears the description with null', async () => {
      repo.update.mockResolvedValue(project);

      await service.update(member, 'p-1', { description: null });

      expect(repo.update).toHaveBeenCalledWith('ws-1', 'p-1', {
        description: null,
      });
    });

    it('returns 404 when the project is not in this workspace', async () => {
      repo.update.mockRejectedValue(prismaError('P2025'));

      await expect(
        service.update(member, 'p-other', { name: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes inside the verified workspace', async () => {
      repo.delete.mockResolvedValue(undefined);

      await service.delete(member, 'p-1');

      expect(repo.delete).toHaveBeenCalledWith('ws-1', 'p-1');
    });

    it('returns 404 when the project is not in this workspace', async () => {
      repo.delete.mockRejectedValue(prismaError('P2025'));

      await expect(service.delete(member, 'p-other')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
