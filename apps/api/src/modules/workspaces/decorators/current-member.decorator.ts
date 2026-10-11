import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { WorkspaceMember, WorkspaceRequest } from '../workspace-member';

/** The caller's membership, as verified by WorkspaceRoleGuard. */
export const CurrentMember = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): WorkspaceMember => {
    const request = ctx.switchToHttp().getRequest<WorkspaceRequest>();
    if (!request.workspaceMember) {
      // Only possible if the controller is missing WorkspaceRoleGuard: fail closed.
      throw new InternalServerErrorException('WorkspaceRoleGuard did not run');
    }
    return request.workspaceMember;
  },
);
