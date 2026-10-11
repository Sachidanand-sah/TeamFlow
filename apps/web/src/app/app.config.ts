import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { appRoutes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthService } from './core/auth/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Restore the session from the refresh cookie BEFORE the first navigation, so
    // route guards already know whether the user is signed in.
    provideAppInitializer(() => inject(AuthService).restoreSession()),
    // Route params (e.g. :workspaceId) arrive as component inputs.
    provideRouter(appRoutes, withComponentInputBinding()),
  ],
};
