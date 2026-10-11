import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Design-system button. Dumb component: no services, only inputs and native events
 * (listen with `(click)` on the host). Project an <tf-icon> before the label for an
 * icon button.
 */
@Component({
  selector: 'tf-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.block]': 'block()' },
  template: `
    <button
      [type]="type()"
      [disabled]="disabled() || loading()"
      [attr.aria-busy]="loading()"
      [attr.aria-label]="ariaLabel()"
      [class]="'tf-button tf-button--' + variant() + ' tf-button--' + size()"
    >
      @if (loading()) {
        <span class="tf-button__spinner" aria-hidden="true"></span>
      }
      <ng-content />
    </button>
  `,
  styleUrl: './button.scss',
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly type = input<'button' | 'submit'>('button');
  readonly disabled = input(false);
  readonly loading = input(false);
  /** Stretch to the container's width (forms, auth pages). */
  readonly block = input(false);
  /** Needed when the button only contains an icon. */
  readonly ariaLabel = input<string | null>(null);
}
