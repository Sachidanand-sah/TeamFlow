import {
  ExecutionContext,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspaceRole } from '@teamflow/shared';
import { Membership } from '../../../generated/prisma/client';
import { MembershipsRepository } from '../memberships.repository';
import { WorkspaceRequest } from '../workspace-member';
import { WorkspaceRoleGuard } from './workspace-role.guard';

const WORKSPACE_ID = '0b5f8c1e-3a8e-4c0e-9f7a-1d2b3c4d5e6f';

function membership(role: WorkspaceRole): Membership {
  return {
    id: 'm-1',
    workspaceId: WORKSPACE_ID,
    userId: 'user-1',
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('WorkspaceRoleGuard', () => {
  let reflector: Reflector;
  let repo: jest.Mocked<Pick<MembershipsRepository, 'find'>>;
  let guard: WorkspaceRoleGuard;
  let request: Partial<WorkspaceRequest>;

  function context(): ExecutionContext {
    return {
      getHandler: () => () => undefined,
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  function requireRole(role: WorkspaceRole | undefined): void {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(role);
  }

  beforeEach(() => {
    reflector = new Reflector();
    repo = { find: jest.fn() };
    guard = new WorkspaceRoleGuard(
      reflector,
      repo as unknown as MembershipsRepository,
    );
    request = {
      user: { id: 'user-1', email: 'ann@example.com' },
      params: { workspaceId: WORKSPACE_ID },
    };
  });

  it('fails closed when the route did not declare a role', async () => {
    requireRole(undefined);

    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(repo.find).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests', async () => {
    requireRole('VIEWER');
    request.user = undefined;

    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('answers 404 for a malformed workspace id without querying', async () => {
    requireRole('VIEWER');
    request.params = { workspaceId: 'not-a-uuid' };

    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.find).not.toHaveBeenCalled();
  });

  it('answers 404 (not 403) to non-members, hiding that the workspace exists', async () => {
    requireRole('VIEWER');
    repo.find.mockResolvedValue(null);

    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.find).toHaveBeenCalledWith(WORKSPACE_ID, 'user-1');
  });

  it('answers 403 to members whose role is too low', async () => {
    requireRole('ADMIN');
    repo.find.mockResolvedValue(membership('MEMBER'));

    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows a sufficient role and attaches the verified membership', async () => {
    requireRole('ADMIN');
    repo.find.mockResolvedValue(membership('OWNER'));

    await expect(guard.canActivate(context())).resolves.toBe(true);
    expect(request.workspaceMember).toEqual({
      workspaceId: WORKSPACE_ID,
      userId: 'user-1',
      role: 'OWNER',
    });
  });
});
