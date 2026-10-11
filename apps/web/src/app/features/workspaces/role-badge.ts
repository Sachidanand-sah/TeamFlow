import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { WorkspaceRole } from '@teamflow/shared';

/** Dumb: shows a role as a small pill. */
@Component({
  selector: 'tf-role-badge',
  template: `{{ role().toLowerCase() }}`,
  host: {
    class: 'role-badge',
    '[class.role-badge--strong]': "role() === 'OWNER' || role() === 'ADMIN'",
  },
  styles: `
    :host {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      border: 1px solid var(--tf-color-border);
      border-radius: 999px;
      font-size: 0.75rem;
      text-transform: capitalize;
      color: var(--tf-color-text-muted);
    }
    :host(.role-badge--strong) {
      border-color: var(--tf-color-primary);
      color: var(--tf-color-primary);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleBadge {
  readonly role = input.required<WorkspaceRole>();
}
