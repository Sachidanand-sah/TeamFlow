import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '@teamflow/ui';
import { AuthService } from '../../core/auth/auth.service';

/** Placeholder landing page until workspaces (MVP step 2) exist. */
@Component({
  selector: 'tf-home-page',
  imports: [ButtonComponent],
  template: `
    <header class="home-header">
      <strong>TeamFlow</strong>
      <tf-button
        variant="secondary"
        [loading]="signingOut()"
        (click)="logout()"
      >
        Sign out
      </tf-button>
    </header>
    <main class="home-main">
      <h1>Welcome, {{ auth.user()?.name }}</h1>
      <p>Signed in as {{ auth.user()?.email }}. Workspaces are coming next.</p>
    </main>
  `,
  styles: `
    .home-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--tf-color-border);
      background: var(--tf-color-surface);
    }
    .home-main {
      max-width: 60rem;
      margin: 0 auto;
      padding: 2rem 1rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
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
