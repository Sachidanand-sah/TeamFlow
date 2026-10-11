import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthResponse } from '@teamflow/shared';
import { AuthService } from './auth.service';

const session: AuthResponse = {
  accessToken: 'access-1',
  expiresIn: 900,
  user: {
    id: 'user-1',
    email: 'ann@example.com',
    name: 'Ann',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
};

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('starts signed out', () => {
    expect(service.isAuthenticated()).toBe(false);
    expect(service.getAccessToken()).toBeNull();
  });

  it('login stores the session in memory and emits the user', () => {
    let emitted: unknown;
    service
      .login({ email: 'ann@example.com', password: 'pw' })
      .subscribe((user) => (emitted = user));

    const req = http.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBe(true);
    req.flush(session);

    expect(emitted).toEqual(session.user);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.user()).toEqual(session.user);
    expect(service.getAccessToken()).toBe('access-1');
  });

  it('never writes the token to web storage', () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem');

    service.login({ email: 'ann@example.com', password: 'pw' }).subscribe();
    http.expectOne('/api/auth/login').flush(session);

    expect(setItem).not.toHaveBeenCalled();
  });

  it('register stores the session', () => {
    service
      .register({
        email: 'ann@example.com',
        name: 'Ann',
        password: 'long-password',
      })
      .subscribe();
    http.expectOne('/api/auth/register').flush(session);

    expect(service.isAuthenticated()).toBe(true);
  });

  it('shares one refresh request between concurrent callers', () => {
    const results: string[] = [];
    service.refresh().subscribe((r) => results.push(r.accessToken));
    service.refresh().subscribe((r) => results.push(r.accessToken));

    http
      .expectOne('/api/auth/refresh')
      .flush({ ...session, accessToken: 'access-2' });

    expect(results).toEqual(['access-2', 'access-2']);
    expect(service.getAccessToken()).toBe('access-2');
  });

  it('sends a new refresh request once the previous one finished', () => {
    service.refresh().subscribe();
    http.expectOne('/api/auth/refresh').flush(session);

    service.refresh().subscribe();
    http.expectOne('/api/auth/refresh').flush(session);
  });

  it('clears the session when refresh fails', () => {
    service.login({ email: 'ann@example.com', password: 'pw' }).subscribe();
    http.expectOne('/api/auth/login').flush(session);

    service.refresh().subscribe({ error: () => undefined });
    http
      .expectOne('/api/auth/refresh')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(service.isAuthenticated()).toBe(false);
    expect(service.getAccessToken()).toBeNull();
  });

  it('restoreSession resolves even when there is no valid cookie', async () => {
    const restored = service.restoreSession();
    http
      .expectOne('/api/auth/refresh')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(restored).resolves.toBeUndefined();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('logout clears the session even if the request fails', () => {
    service.login({ email: 'ann@example.com', password: 'pw' }).subscribe();
    http.expectOne('/api/auth/login').flush(session);

    let completed = false;
    service.logout().subscribe({ complete: () => (completed = true) });
    http
      .expectOne('/api/auth/logout')
      .flush(null, { status: 500, statusText: 'Server Error' });

    expect(completed).toBe(true);
    expect(service.isAuthenticated()).toBe(false);
  });
});
