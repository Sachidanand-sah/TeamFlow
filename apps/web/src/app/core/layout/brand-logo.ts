import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** The TeamFlow mark (gradient tile with three board columns) + optional word mark. */
@Component({
  selector: 'tf-brand-logo',
  template: `
    <svg
      class="mark"
      viewBox="0 0 32 32"
      [attr.width]="size()"
      [attr.height]="size()"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="tf-logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#4f46e5" />
          <stop offset="0.6" stop-color="#7c3aed" />
          <stop offset="1" stop-color="#db2777" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#tf-logo-gradient)" />
      <rect x="7" y="8" width="5" height="16" rx="2" fill="#fff" />
      <rect
        x="13.5"
        y="8"
        width="5"
        height="11"
        rx="2"
        fill="#fff"
        opacity="0.85"
      />
      <rect
        x="20"
        y="8"
        width="5"
        height="7"
        rx="2"
        fill="#fff"
        opacity="0.7"
      />
    </svg>
    @if (wordmark()) {
      <span class="word">TeamFlow</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 0.625rem;
    }
    .mark {
      flex-shrink: 0;
      filter: drop-shadow(0 2px 6px rgb(79 70 229 / 35%));
    }
    .word {
      color: var(--tf-color-text);
      font-size: 1.0625rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandLogo {
  readonly size = input(30);
  readonly wordmark = input(true);
}
