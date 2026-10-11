import type { CookieOptions, Request, Response } from 'express';
import { IssuedRefreshToken } from './auth.types';

export const REFRESH_COOKIE_NAME = 'tf_refresh';

/**
 * WHY each flag:
 * - httpOnly: JavaScript cannot read the cookie, so an XSS bug cannot steal it.
 * - secure: only sent over HTTPS (browsers treat http://localhost as secure for dev).
 * - sameSite 'strict': never sent on requests started by another site, which blocks
 *   CSRF against /refresh and /logout.
 * - path '/api/auth': the cookie is not even sent to other endpoints, which shrinks
 *   where it could leak.
 */
const baseOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/api/auth',
};

export function setRefreshCookie(
  res: Response,
  token: IssuedRefreshToken,
): void {
  res.cookie(REFRESH_COOKIE_NAME, token.token, {
    ...baseOptions,
    expires: token.expiresAt,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, baseOptions);
}

export function readRefreshCookie(req: Request): string | undefined {
  // cookie-parser types cookies as `any`; narrow it to what we actually accept.
  const value: unknown = req.cookies?.[REFRESH_COOKIE_NAME];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
