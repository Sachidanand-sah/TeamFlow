import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WorkspaceRole } from '@teamflow/shared';
import { Membership, Prisma, User } from '../../generated/prisma/client';
import { UsersService } from '../users/users.service';
import { MembersService } from './members.service';
import {
  MembershipsRepository,
  MembershipWithUser,
} from './memberships.repository';
import { WorkspaceMember } from './workspace-member';

const WS = 'ws-1';
const joined = new Date('2026-03-01T00:00:00.000Z');

const actor = (role: WorkspaceRole): WorkspaceMember => ({
  workspaceId: WS,
  userId: 'actor',
  role,
});

function membership(userId: string, role: WorkspaceRole): Membership {
  return {
    id: `m-${userId}`,
    workspaceId: WS,
    userId,
    role,
    createdAt: joined,
    updatedAt: joined,
  };
}

function withUser(userId: string, role: WorkspaceRole): MembershipWithUser {
  return {
    ...membership(userId, role),
    user: {
      id: userId,
      name: `User ${userId}`,
      email: `${userId}@example.com`,
    },
  };
}

const bob: User = {
  id: 'bob',
  email: 'bob@example.com',
  name: 'Bob',
  passwordHash: 'hash',
  createdAt: joined,
  updatedAt: joined,
};

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('db error', {
    code,
    clientVersion: 'test',
  });

describe('MembersService', () => {
  let repo: jest.Mocked<
    Pick<
      MembershipsRepository,
      'find' | 'list' | 'create' | 'updateRole' | 'delete'
    >
  >;
  let users: jest.Mocked<Pick<UsersService, 'findByEmail'>>;
  let service: MembersService;

  beforeEach(() => {
    repo = {
      find: jest.fn(),
      list: jest.fn(),
      create: jest.fn(),
      updateRole: jest.fn(),
      delete: jest.fn(),
    };
    users = { findByEmail: jest.fn() };
    service = new MembersService(
      repo as unknown as MembershipsRepository,
      users as unknown as UsersService,
    );
  });

  describe('list', () => {
    it("lists only the actor's workspace, without password hashes", async () => {
      repo.list.mockResolvedValue([
        withUser('actor', 'OWNER'),
        withUser('bob', 'VIEWER'),
      ]);

      const result = await service.list(actor('VIEWER'));

      expect(repo.list).toHaveBeenCalledWith(WS);
      expect(result[1]).toEqual({
        userId: 'bob',
        name: 'User bob',
        email: 'bob@example.com',
        role: 'VIEWER',
        joinedAt: '2026-03-01T00:00:00.000Z',
      });
      expect(JSON.stringify(result)).not.toContain('hash');
    });
  });

  describe('add', () => {
    it('adds an existing user with the requested role', async () => {
      users.findByEmail.mockResolvedValue(bob);
      repo.create.mockResolvedValue(withUser('bob', 'MEMBER'));

      const result = await service.add(actor('ADMIN'), {
        email: 'bob@example.com',
        role: 'MEMBER',
      });

      expect(repo.create).toHaveBeenCalledWith(WS, 'bob', 'MEMBER');
      expect(result.role).toBe('MEMBER');
    });

    it('forbids an ADMIN from granting ADMIN', async () => {
      await expect(
        service.add(actor('ADMIN'), {
          email: 'bob@example.com',
          role: 'ADMIN',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(users.findByEmail).not.toHaveBeenCalled();
    });

    it('lets the OWNER grant ADMIN', async () => {
      users.findByEmail.mockResolvedValue(bob);
      repo.create.mockResolvedValue(withUser('bob', 'ADMIN'));

      await service.add(actor('OWNER'), {
        email: 'bob@example.com',
        role: 'ADMIN',
      });

      expect(repo.create).toHaveBeenCalledWith(WS, 'bob', 'ADMIN');
    });

    it('returns 404 when no account has that email', async () => {
      users.findByEmail.mockResolvedValue(null);

      await expect(
        service.add(actor('ADMIN'), {
          email: 'nobody@example.com',
          role: 'VIEWER',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns 409 when the user is already a member', async () => {
      users.findByEmail.mockResolvedValue(bob);
      repo.create.mockRejectedValue(prismaError('P2002'));

      await expect(
        service.add(actor('ADMIN'), {
          email: 'bob@example.com',
          role: 'VIEWER',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('changeRole', () => {
    it('lets an ADMIN change a MEMBER to VIEWER', async () => {
      repo.find.mockResolvedValue(membership('bob', 'MEMBER'));
      repo.updateRole.mockResolvedValue(withUser('bob', 'VIEWER'));

      const result = await service.changeRole(actor('ADMIN'), 'bob', 'VIEWER');

      expect(repo.find).toHaveBeenCalledWith(WS, 'bob');
      expect(repo.updateRole).toHaveBeenCalledWith(WS, 'bob', 'VIEWER');
      expect(result.role).toBe('VIEWER');
    });

    it('forbids changing your own role', async () => {
      await expect(
        service.changeRole(actor('ADMIN'), 'actor', 'VIEWER'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.find).not.toHaveBeenCalled();
    });

    it('forbids an ADMIN from changing another ADMIN', async () => {
      repo.find.mockResolvedValue(membership('bob', 'ADMIN'));

      await expect(
        service.changeRole(actor('ADMIN'), 'bob', 'MEMBER'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.updateRole).not.toHaveBeenCalled();
    });

    it('forbids an ADMIN from promoting someone to ADMIN', async () => {
      repo.find.mockResolvedValue(membership('bob', 'MEMBER'));

      await expect(
        service.changeRole(actor('ADMIN'), 'bob', 'ADMIN'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('forbids anyone from changing the OWNER', async () => {
      repo.find.mockResolvedValue(membership('bob', 'OWNER'));

      await expect(
        service.changeRole(actor('ADMIN'), 'bob', 'VIEWER'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns 404 for someone who is not in this workspace', async () => {
      repo.find.mockResolvedValue(null);

      await expect(
        service.changeRole(actor('OWNER'), 'stranger', 'VIEWER'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns 404 if the member was removed concurrently', async () => {
      repo.find.mockResolvedValue(membership('bob', 'MEMBER'));
      repo.updateRole.mockRejectedValue(prismaError('P2025'));

      await expect(
        service.changeRole(actor('OWNER'), 'bob', 'VIEWER'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('lets any non-owner member leave', async () => {
      await service.remove(actor('VIEWER'), 'actor');

      expect(repo.delete).toHaveBeenCalledWith(WS, 'actor');
    });

    it('forbids the OWNER from leaving', async () => {
      await expect(
        service.remove(actor('OWNER'), 'actor'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('lets an ADMIN remove a MEMBER', async () => {
      repo.find.mockResolvedValue(membership('bob', 'MEMBER'));

      await service.remove(actor('ADMIN'), 'bob');

      expect(repo.delete).toHaveBeenCalledWith(WS, 'bob');
    });

    it('forbids a MEMBER from removing someone else', async () => {
      repo.find.mockResolvedValue(membership('bob', 'VIEWER'));

      await expect(
        service.remove(actor('MEMBER'), 'bob'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('forbids an ADMIN from removing the OWNER', async () => {
      repo.find.mockResolvedValue(membership('bob', 'OWNER'));

      await expect(
        service.remove(actor('ADMIN'), 'bob'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns 404 for someone who is not in this workspace', async () => {
      repo.find.mockResolvedValue(null);

      await expect(
        service.remove(actor('OWNER'), 'stranger'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
