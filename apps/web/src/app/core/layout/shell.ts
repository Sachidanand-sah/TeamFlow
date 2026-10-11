import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AvatarComponent, ButtonComponent, IconComponent } from '@teamflow/ui';
import { AuthService } from '../auth/auth.service';
import { BrandLogo } from './brand-logo';

/** Frame for every signed-in page: top bar + routed content. */
@Component({
  selector: 'tf-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    ButtonComponent,
    AvatarComponent,
    IconComponent,
    BrandLogo,
  ],
  template: `
    <header class="topbar">
      <div class="topbar__inner">
        <a class="topbar__brand" routerLink="/" aria-label="TeamFlow home">
          <tf-brand-logo />
        </a>

        <nav class="topbar__nav" aria-label="Main">
          <a routerLink="/" class="topbar__link">
            <tf-icon name="folder" />
            Workspaces
          </a>
        </nav>

        @if (auth.user(); as user) {
          <div class="topbar__user">
            <tf-avatar [name]="user.name" [size]="32" />
            <div class="topbar__who">
              <span class="topbar__name">{{ user.name }}</span>
              <span class="topbar__email">{{ user.email }}</span>
            </div>
            <tf-button
              variant="ghost"
              size="sm"
              [loading]="signingOut()"
              (click)="logout()"
            >
              <tf-icon name="log-out" />
              Sign out
            </tf-button>
          </div>
        }
      </div>
    </header>
    <main class="tf-page">
      <router-outlet />
    </main>
  `,
  styles: `
    .topbar {
      position: sticky;
      top: 0;
      z-index: 5;
      border-bottom: 1px solid var(--tf-color-border);
      background: color-mix(in srgb, var(--tf-color-surface) 85%, transparent);
      backdrop-filter: saturate(180%) blur(12px);
    }
    .topbar__inner {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      max-width: 76rem;
      height: 3.75rem;
      margin: 0 auto;
      padding: 0 1.5rem;
    }
    .topbar__brand {
      display: flex;
      text-decoration: none;
    }
    .topbar__nav {
      display: flex;
      flex: 1;
      gap: 0.25rem;
    }
    .topbar__link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.375rem 0.75rem;
      border-radius: var(--tf-radius);
      color: var(--tf-color-text-muted);
      font-weight: 500;
      text-decoration: none;
    }
    .topbar__link:hover {
      background: var(--tf-color-surface-hover);
      color: var(--tf-color-text);
      text-decoration: none;
    }
    .topbar__user {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .topbar__who {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
    }
    .topbar__name {
      font-weight: 600;
      font-size: 0.8125rem;
    }
    .topbar__email {
      color: var(--tf-color-text-muted);
      font-size: 0.75rem;
    }
    @media (max-width: 640px) {
      .topbar__who,
      .topbar__nav {
        display: none;
      }
      .topbar__user {
        margin-left: auto;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly signingOut = signal(false);

  protected logout(): void {
    this.signingOut.set(true);
    this.auth.logout().subscribe({
      complete: () => void this.router.navigateByUrl('/login'),
    });
  }
}
