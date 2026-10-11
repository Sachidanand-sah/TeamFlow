import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasAtLeastRole, WorkspaceRole } from '@teamflow/shared';
import { isUUID } from 'class-validator';
import { MembershipsRepository } from '../memberships.repository';
import { WorkspaceRequest } from '../workspace-member';

const WORKSPACE_ROLE_KEY = 'workspaceRole';

/**
 * Minimum role needed for a workspace-scoped route, e.g.
 * `@RequireWorkspaceRole('ADMIN')` allows ADMIN and OWNER.
 */
export const RequireWorkspaceRole = (
  minimum: WorkspaceRole,
): MethodDecorator & ClassDecorator => SetMetadata(WORKSPACE_ROLE_KEY, minimum);

/**
 * RBAC for every route under `/workspaces/:workspaceId`.
 *
 * 1. Loads the caller's membership for the workspace in the URL from the database.
 *    The client only names a workspace; whether they may touch it is decided here.
 * 2. Not a member -> 404, not 403. WHY: 403 would confirm that the workspace exists,
 *    letting outsiders probe ids. To an outsider it simply does not exist.
 * 3. Member but role too low -> 403 (they know the workspace, so nothing leaks).
 * 4. Attaches the verified membership to the request for @CurrentMember().
 *
 * Runs after the global JwtAuthGuard (controller guards always run after global ones).
 */
@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly memberships: MembershipsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const minimum = this.reflector.getAllAndOverride<WorkspaceRole | undefined>(
      WORKSPACE_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!minimum) {
      // Fail closed: a route that forgot to declare its role is a bug, not public.
      throw new InternalServerErrorException(
        'Route is missing @RequireWorkspaceRole',
      );
    }

    const request = context.switchToHttp().getRequest<WorkspaceRequest>();
    if (!request.user) {
      throw new UnauthorizedException();
    }

    const workspaceId = request.params['workspaceId'];
    if (typeof workspaceId !== 'string' || !isUUID(workspaceId)) {
      throw new NotFoundException('Workspace not found');
    }

    const membership = await this.memberships.find(
      workspaceId,
      request.user.id,
    );
    if (!membership) {
      throw new NotFoundException('Workspace not found');
    }
    if (!hasAtLeastRole(membership.role, minimum)) {
      throw new ForbiddenException('Your role does not allow this action');
    }

    request.workspaceMember = {
      workspaceId,
      userId: request.user.id,
      role: membership.role,
    };
    return true;
  }
}
