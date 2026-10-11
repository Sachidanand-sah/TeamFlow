import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { authGuard, guestGuard, safeReturnUrl } from './auth.guards';
import { AuthService } from './auth.service';

describe('auth guards', () => {
  let signedIn: boolean;

  beforeEach(() => {
    signedIn = false;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isAuthenticated: () => signedIn } },
      ],
    });
  });

  function run(guard: typeof authGuard, url = '/projects/1') {
    return TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    );
  }

  describe('authGuard', () => {
    it('allows signed-in users', () => {
      signedIn = true;
      expect(run(authGuard)).toBe(true);
    });

    it('redirects guests to /login and remembers where they were going', () => {
      const result = run(authGuard) as UrlTree;
      const router = TestBed.inject(Router);

      expect(router.serializeUrl(result)).toBe(
        '/login?returnUrl=%2Fprojects%2F1',
      );
    });

    it('omits returnUrl for the home page', () => {
      const result = run(authGuard, '/') as UrlTree;

      expect(TestBed.inject(Router).serializeUrl(result)).toBe('/login');
    });
  });

  describe('guestGuard', () => {
    it('allows guests', () => {
      expect(run(guestGuard)).toBe(true);
    });

    it('sends signed-in users home', () => {
      signedIn = true;
      const result = run(guestGuard) as UrlTree;

      expect(TestBed.inject(Router).serializeUrl(result)).toBe('/');
    });
  });
});

describe('safeReturnUrl', () => {
  it.each([
    [null, '/'],
    ['', '/'],
    ['/projects/1?tab=board', '/projects/1?tab=board'],
    ['https://evil.example', '/'],
    ['//evil.example', '/'],
    ['javascript:alert(1)', '/'],
  ])('%p -> %p', (input, expected) => {
    expect(safeReturnUrl(input)).toBe(expected);
  });
});
