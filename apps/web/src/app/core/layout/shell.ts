import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { ButtonComponent } from '@teamflow/ui';
import { AuthService } from '../auth/auth.service';

/** Frame for every signed-in page: top bar + routed content. */
@Component({
  selector: 'tf-shell',
  imports: [RouterOutlet, RouterLink, ButtonComponent],
  template: `
    <header class="shell-header">
      <a class="shell-brand" routerLink="/">TeamFlow</a>
      <div class="shell-user">
        <span class="shell-user__name">{{ auth.user()?.name }}</span>
        <tf-button
          variant="secondary"
          [loading]="signingOut()"
          (click)="logout()"
        >
          Sign out
        </tf-button>
      </div>
    </header>
    <main class="shell-main">
      <router-outlet />
    </main>
  `,
  styles: `
    .shell-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--tf-color-border);
      background: var(--tf-color-surface);
    }
    .shell-brand {
      font-weight: 700;
      color: var(--tf-color-text);
      text-decoration: none;
    }
    .shell-user {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .shell-user__name {
      color: var(--tf-color-text-muted);
      font-size: 0.875rem;
    }
    .shell-main {
      max-width: 72rem;
      margin: 0 auto;
      padding: 2rem 1rem;
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
