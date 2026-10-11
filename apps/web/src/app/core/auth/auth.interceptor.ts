import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

const API_PREFIX = '/api/';
const AUTH_PREFIX = '/api/auth/';

/**
 * - Adds `Authorization: Bearer <access token>` to our own API calls only. Sending it
 *   to any other URL would hand our credential to a third party.
 * - On a 401, refreshes the access token once and retries the request. If the
 *   refresh fails too, the session is over and the user goes to /login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_PREFIX)) {
    return next(req);
  }
  // Auth endpoints use the refresh cookie, not the access token. Retrying them on
  // 401 would loop (a failed refresh would trigger another refresh).
  if (req.url.startsWith(AUTH_PREFIX)) {
    return next(req);
  }

  const auth = inject(AuthService);
  const router = inject(Router);

  return sendWithToken(req, next, auth.getAccessToken()).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }
      return auth.refresh().pipe(
        catchError((refreshError: unknown) => {
          void router.navigateByUrl('/login');
          return throwError(() => refreshError);
        }),
        switchMap((session) => sendWithToken(req, next, session.accessToken)),
      );
    }),
  );
};

function sendWithToken(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  token: string | null,
) {
  return next(
    token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req,
  );
}
