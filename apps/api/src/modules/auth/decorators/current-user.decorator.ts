import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticatedRequest, AuthenticatedUser } from '../auth.types';

/** Injects the user that JwtAuthGuard attached to the request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      // Only reachable if used on a @Public() route: a programming error, fail closed.
      throw new UnauthorizedException();
    }
    return request.user;
  },
);
