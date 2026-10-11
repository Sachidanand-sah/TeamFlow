import type { Request } from 'express';

/** Claims inside the access token (a JWT). Keep it small: it is sent on every request. */
export interface AccessTokenPayload {
  /** Subject: the user id (standard JWT claim name). */
  sub: string;
  email: string;
}

/** What `@CurrentUser()` gives a controller after JwtAuthGuard has run. */
export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/** A freshly generated refresh token. `token` is the raw value that goes into the cookie. */
export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}
