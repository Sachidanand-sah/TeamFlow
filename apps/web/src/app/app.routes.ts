import { Route } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guards';

// Pages are lazy-loaded so each feature ships in its own bundle.
export const appRoutes: Route[] = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Sign in · TeamFlow',
    loadComponent: () =>
      import('./features/auth/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    title: 'Create account · TeamFlow',
    loadComponent: () =>
      import('./features/auth/register/register.page').then(
        (m) => m.RegisterPage,
      ),
  },
  {
    path: '',
    pathMatch: 'full',
    canActivate: [authGuard],
    title: 'TeamFlow',
    loadComponent: () =>
      import('./features/home/home.page').then((m) => m.HomePage),
  },
  { path: '**', redirectTo: '' },
];
