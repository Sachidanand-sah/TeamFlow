import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type BadgeTone =
  'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

/** Small rounded label for statuses, roles and priorities. */
@Component({
  selector: 'tf-badge',
  template: `
    @if (dot()) {
      <span class="dot" aria-hidden="true"></span>
    }
    <ng-content />
  `,
  host: { '[class]': "'tone-' + tone()" },
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.125rem 0.5rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 500;
      line-height: 1.25rem;
      white-space: nowrap;
    }
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }
    :host(.tone-neutral) {
      background: var(--tf-color-surface-2);
      color: var(--tf-color-text-muted);
    }
    :host(.tone-primary) {
      background: var(--tf-color-primary-soft);
      color: var(--tf-color-primary-soft-text);
    }
    :host(.tone-success) {
      background: var(--tf-color-success-surface);
      color: var(--tf-color-success);
    }
    :host(.tone-warning) {
      background: var(--tf-color-warning-surface);
      color: var(--tf-color-warning);
    }
    :host(.tone-danger) {
      background: var(--tf-color-danger-surface);
      color: var(--tf-color-danger);
    }
    :host(.tone-info) {
      background: var(--tf-color-info-surface);
      color: var(--tf-color-info);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BadgeComponent {
  readonly tone = input<BadgeTone>('neutral');
  readonly dot = input(false);
}
