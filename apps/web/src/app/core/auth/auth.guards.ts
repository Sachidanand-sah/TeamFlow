import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Route guards are UX only: they decide which screen to show. Real protection is the
 * API's JwtAuthGuard, because anything in the browser can be bypassed.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  if (inject(AuthService).isAuthenticated()) {
    return true;
  }
  // '/' is where login lands anyway, so it does not need a returnUrl.
  const queryParams = state.url === '/' ? {} : { returnUrl: state.url };
  return inject(Router).createUrlTree(['/login'], { queryParams });
};

/** Keeps signed-in users away from /login and /register. */
export const guestGuard: CanActivateFn = () =>
  inject(AuthService).isAuthenticated()
    ? inject(Router).createUrlTree(['/'])
    : true;

/**
 * Only allows app-internal paths as post-login redirect targets.
 * WHY: `?returnUrl=https://evil.example` must not turn our login page into an open
 * redirect that phishing links can abuse. `//evil.example` is protocol-relative,
 * so it is rejected too.
 */
export function safeReturnUrl(returnUrl: string | null): string {
  if (!returnUrl || !returnUrl.startsWith('/') || returnUrl.startsWith('//')) {
    return '/';
  }
  return returnUrl;
}
