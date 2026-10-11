import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opts a route out of the global JwtAuthGuard.
 *
 * WHY secure-by-default: the guard runs on every route, so forgetting a decorator
 * leaves an endpoint *closed*, not open. Making a route public is a visible,
 * deliberate choice that shows up in code review.
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
