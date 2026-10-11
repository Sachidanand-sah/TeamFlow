import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  UserDto,
} from '@teamflow/shared';
import {
  catchError,
  finalize,
  firstValueFrom,
  map,
  Observable,
  of,
  shareReplay,
  tap,
} from 'rxjs';

const AUTH_API = '/api/auth';

/**
 * Holds the session for the whole app.
 *
 * The access token lives only in this signal (memory). It is never written to
 * localStorage/sessionStorage, which any injected script could read. After a page
 * reload it is gone, and `restoreSession()` gets a new one through the httpOnly
 * refresh cookie, which JavaScript cannot see at all.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly accessToken = signal<string | null>(null);
  private readonly currentUser = signal<UserDto | null>(null);
  private refreshInFlight$: Observable<AuthResponse> | null = null;

  readonly user = this.currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  getAccessToken(): string | null {
    return this.accessToken();
  }

  login(request: LoginRequest): Observable<UserDto> {
    return this.http
      .post<AuthResponse>(`${AUTH_API}/login`, request, {
        withCredentials: true,
      })
      .pipe(
        tap((response) => this.setSession(response)),
        map((response) => response.user),
      );
  }

  register(request: RegisterRequest): Observable<UserDto> {
    return this.http
      .post<AuthResponse>(`${AUTH_API}/register`, request, {
        withCredentials: true,
      })
      .pipe(
        tap((response) => this.setSession(response)),
        map((response) => response.user),
      );
  }

  /**
   * Exchanges the refresh cookie for a new access token.
   *
   * Concurrent callers share ONE request: the server rotates the refresh token on
   * every use, so two parallel refreshes would make the second look like a stolen,
   * reused token and end the session.
   */
  refresh(): Observable<AuthResponse> {
    this.refreshInFlight$ ??= this.http
      .post<AuthResponse>(`${AUTH_API}/refresh`, null, {
        withCredentials: true,
      })
      .pipe(
        tap({
          next: (response) => this.setSession(response),
          error: () => this.clearSession(),
        }),
        finalize(() => (this.refreshInFlight$ = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.refreshInFlight$;
  }

  /** Called once at startup. Never fails: no valid cookie just means "signed out". */
  restoreSession(): Promise<void> {
    return firstValueFrom(
      this.refresh().pipe(
        map(() => undefined),
        catchError(() => of(undefined)),
      ),
    );
  }

  /** Clears the local session even if the request fails (e.g. offline). */
  logout(): Observable<void> {
    return this.http
      .post<void>(`${AUTH_API}/logout`, null, { withCredentials: true })
      .pipe(
        catchError(() => of(undefined)),
        finalize(() => this.clearSession()),
        map(() => undefined),
      );
  }

  private setSession(response: AuthResponse): void {
    this.accessToken.set(response.accessToken);
    this.currentUser.set(response.user);
  }

  private clearSession(): void {
    this.accessToken.set(null);
    this.currentUser.set(null);
  }
}
