import { NotFoundException } from '@nestjs/common';
import { Prisma, Workspace } from '../../generated/prisma/client';
import { WorkspaceMember } from './workspace-member';
import {
  MembershipWithWorkspace,
  WorkspacesRepository,
} from './workspaces.repository';
import { WorkspacesService } from './workspaces.service';

const workspace: Workspace = {
  id: 'ws-1',
  name: 'Acme',
  createdAt: new Date('2026-02-01T00:00:00.000Z'),
  updatedAt: new Date('2026-02-01T00:00:00.000Z'),
};

const owner: WorkspaceMember = {
  workspaceId: 'ws-1',
  userId: 'user-1',
  role: 'OWNER',
};

function membershipIn(ws: Workspace, role: MembershipWithWorkspace['role']) {
  return {
    id: `m-${ws.id}`,
    workspaceId: ws.id,
    userId: 'user-1',
    role,
    createdAt: ws.createdAt,
    updatedAt: ws.createdAt,
    workspace: ws,
  };
}

const notFound = () =>
  new Prisma.PrismaClientKnownRequestError('Record not found', {
    code: 'P2025',
    clientVersion: 'test',
  });

describe('WorkspacesService', () => {
  let repo: jest.Mocked<
    Pick<
      WorkspacesRepository,
      'createWithOwner' | 'findAllForUser' | 'findById' | 'rename' | 'delete'
    >
  >;
  let service: WorkspacesService;

  beforeEach(() => {
    repo = {
      createWithOwner: jest.fn(),
      findAllForUser: jest.fn(),
      findById: jest.fn(),
      rename: jest.fn(),
      delete: jest.fn(),
    };
    service = new WorkspacesService(repo as unknown as WorkspacesRepository);
  });

  describe('create', () => {
    it('creates the workspace with the caller as OWNER', async () => {
      repo.createWithOwner.mockResolvedValue(membershipIn(workspace, 'OWNER'));

      const result = await service.create('user-1', '  Acme  ');

      expect(repo.createWithOwner).toHaveBeenCalledWith('Acme', 'user-1');
      expect(result).toEqual({
        id: 'ws-1',
        name: 'Acme',
        role: 'OWNER',
        createdAt: '2026-02-01T00:00:00.000Z',
      });
    });
  });

  describe('listForUser', () => {
    it("returns each workspace with the caller's role in it", async () => {
      const other = { ...workspace, id: 'ws-2', name: 'Beta' };
      repo.findAllForUser.mockResolvedValue([
        membershipIn(workspace, 'OWNER'),
        membershipIn(other, 'VIEWER'),
      ]);

      const result = await service.listForUser('user-1');

      expect(repo.findAllForUser).toHaveBeenCalledWith('user-1');
      expect(result.map((w) => [w.id, w.role])).toEqual([
        ['ws-1', 'OWNER'],
        ['ws-2', 'VIEWER'],
      ]);
    });
  });

  describe('get', () => {
    it('returns the workspace with the verified role', async () => {
      repo.findById.mockResolvedValue(workspace);

      const result = await service.get({ ...owner, role: 'MEMBER' });

      expect(repo.findById).toHaveBeenCalledWith('ws-1');
      expect(result.role).toBe('MEMBER');
    });

    it('throws NotFound if the workspace disappeared after the guard ran', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.get(owner)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('rename', () => {
    it('renames the workspace from the verified membership, trimming the name', async () => {
      repo.rename.mockResolvedValue({ ...workspace, name: 'Acme Inc' });

      const result = await service.rename(owner, ' Acme Inc ');

      expect(repo.rename).toHaveBeenCalledWith('ws-1', 'Acme Inc');
      expect(result.name).toBe('Acme Inc');
    });

    it('maps a concurrently deleted workspace to NotFound', async () => {
      repo.rename.mockRejectedValue(notFound());

      await expect(service.rename(owner, 'X')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('deletes the workspace from the verified membership', async () => {
      repo.delete.mockResolvedValue(undefined);

      await service.delete(owner);

      expect(repo.delete).toHaveBeenCalledWith('ws-1');
    });

    it('maps a concurrently deleted workspace to NotFound', async () => {
      repo.delete.mockRejectedValue(notFound());

      await expect(service.delete(owner)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
