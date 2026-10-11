import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

/** Pleasant, readable background colours; one is picked per name (stable). */
const PALETTE = [
  '#4f46e5',
  '#7c3aed',
  '#db2777',
  '#e11d48',
  '#ea580c',
  '#d97706',
  '#059669',
  '#0891b2',
  '#2563eb',
  '#475569',
];

/** Initials ("Ana Sharma" -> "AS"); at most two letters. */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Same name -> same colour, so people are recognisable across the app. */
export function colorFor(name: string): string {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/** Round initials badge for a person. Decorative: pair it with the visible name. */
@Component({
  selector: 'tf-avatar',
  template: `{{ initials() }}`,
  host: {
    '[style.--size.px]': 'size()',
    '[style.background]': 'color()',
    '[attr.title]': 'name()',
    'aria-hidden': 'true',
  },
  styles: `
    :host {
      display: inline-grid;
      flex-shrink: 0;
      place-items: center;
      width: var(--size);
      height: var(--size);
      border-radius: 50%;
      color: #fff;
      font-size: calc(var(--size) * 0.4);
      font-weight: 600;
      letter-spacing: 0.02em;
      line-height: 1;
      user-select: none;
      box-shadow: 0 0 0 2px var(--tf-color-surface);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarComponent {
  readonly name = input.required<string>();
  readonly size = input(28);

  protected readonly initials = computed(() => initialsOf(this.name()));
  protected readonly color = computed(() => colorFor(this.name()));
}
