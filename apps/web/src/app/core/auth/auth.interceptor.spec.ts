import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: { getAccessToken: jest.Mock; refresh: jest.Mock };
  let router: { navigateByUrl: jest.Mock };

  beforeEach(() => {
    auth = {
      getAccessToken: jest.fn().mockReturnValue('access-1'),
      refresh: jest.fn(),
    };
    router = { navigateByUrl: jest.fn().mockResolvedValue(true) };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('adds the bearer token to API requests', () => {
    http.get('/api/users/me').subscribe();

    const req = backend.expectOne('/api/users/me');
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-1');
    req.flush({});
  });

  it('never sends the token to other origins', () => {
    http.get('https://example.com/data').subscribe();

    const req = backend.expectOne('https://example.com/data');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('does not add the token or retry on auth endpoints', () => {
    http.post('/api/auth/refresh', null).subscribe({ error: () => undefined });

    const req = backend.expectOne('/api/auth/refresh');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(auth.refresh).not.toHaveBeenCalled();
  });

  it('refreshes once on 401 and retries with the new token', () => {
    auth.refresh.mockReturnValue(of({ accessToken: 'access-2' }));
    let body: unknown;
    http.get('/api/users/me').subscribe((b) => (body = b));

    backend
      .expectOne('/api/users/me')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    const retry = backend.expectOne('/api/users/me');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-2');
    retry.flush({ ok: true });

    expect(auth.refresh).toHaveBeenCalledTimes(1);
    expect(body).toEqual({ ok: true });
  });

  it('sends the user to /login when the refresh fails', () => {
    auth.refresh.mockReturnValue(throwError(() => new Error('expired')));
    let failed = false;
    http.get('/api/users/me').subscribe({ error: () => (failed = true) });

    backend
      .expectOne('/api/users/me')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(failed).toBe(true);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('passes other errors through without refreshing', () => {
    let status = 0;
    http
      .get('/api/users/me')
      .subscribe({ error: (e: { status: number }) => (status = e.status) });

    backend
      .expectOne('/api/users/me')
      .flush(null, { status: 403, statusText: 'Forbidden' });

    expect(status).toBe(403);
    expect(auth.refresh).not.toHaveBeenCalled();
  });
});
