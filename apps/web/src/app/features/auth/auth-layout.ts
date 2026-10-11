import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IconComponent, IconName } from '@teamflow/ui';
import { BrandLogo } from '../../core/layout/brand-logo';

/** Split-screen frame for sign-in and register: brand story left, form right. */
@Component({
  selector: 'tf-auth-layout',
  imports: [BrandLogo, IconComponent],
  template: `
    <div class="auth">
      <aside class="auth__brand" aria-hidden="true">
        <div class="auth__brand-inner">
          <div class="auth__logo">
            <tf-brand-logo [size]="36" [wordmark]="false" />
            <span>TeamFlow</span>
          </div>
          <div class="auth__pitch">
            <h2>Plan, track and ship work — together.</h2>
            <p>
              Boards your whole team understands, updates everyone sees in real
              time.
            </p>
          </div>
          <ul class="auth__features">
            @for (feature of features; track feature.title) {
              <li>
                <span class="auth__feature-icon">
                  <tf-icon [name]="feature.icon" [size]="18" />
                </span>
                <div>
                  <strong>{{ feature.title }}</strong>
                  <span>{{ feature.text }}</span>
                </div>
              </li>
            }
          </ul>
          <p class="auth__footnote">Free for small teams. No credit card.</p>
        </div>
      </aside>

      <main class="auth__main">
        <div class="auth__form">
          <ng-content />
        </div>
      </main>
    </div>
  `,
  styleUrl: './auth-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLayout {
  protected readonly features: {
    icon: IconName;
    title: string;
    text: string;
  }[] = [
    {
      icon: 'kanban',
      title: 'Kanban boards',
      text: 'Drag tasks through To do, In progress, Review and Done.',
    },
    {
      icon: 'zap',
      title: 'Real-time',
      text: 'Every change appears instantly for your whole team.',
    },
    {
      icon: 'shield',
      title: 'Secure by design',
      text: 'Roles per workspace, encrypted sessions, private files.',
    },
  ];
}
