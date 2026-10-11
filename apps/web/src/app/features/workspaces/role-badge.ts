import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { WorkspaceRole } from '@teamflow/shared';
import { BadgeComponent, BadgeTone } from '@teamflow/ui';

const TONES: Record<WorkspaceRole, BadgeTone> = {
  OWNER: 'primary',
  ADMIN: 'info',
  MEMBER: 'neutral',
  VIEWER: 'neutral',
};

/** Dumb: shows a workspace role as a coloured badge. */
@Component({
  selector: 'tf-role-badge',
  imports: [BadgeComponent],
  template: `<tf-badge [tone]="tone()">{{ label() }}</tf-badge>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleBadge {
  readonly role = input.required<WorkspaceRole>();

  protected readonly tone = computed(() => TONES[this.role()]);
  protected readonly label = computed(
    () => this.role().charAt(0) + this.role().slice(1).toLowerCase(),
  );
}
