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
    // Everything below needs a session; the guard on the parent covers all children.
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./core/layout/shell').then((m) => m.Shell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Workspaces · TeamFlow',
        loadComponent: () =>
          import('./features/workspaces/workspace-list/workspace-list.page').then(
            (m) => m.WorkspaceListPage,
          ),
      },
      {
        path: 'workspaces/:workspaceId',
        title: 'Workspace · TeamFlow',
        loadComponent: () =>
          import('./features/workspaces/workspace-detail/workspace-detail.page').then(
            (m) => m.WorkspaceDetailPage,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
