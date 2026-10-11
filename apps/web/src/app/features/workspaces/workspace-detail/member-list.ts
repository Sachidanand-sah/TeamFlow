import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import {
  AssignableWorkspaceRole,
  canAssignRole,
  canManageMember,
  MemberDto,
  WorkspaceRole,
} from '@teamflow/shared';
import { AvatarComponent, IconComponent } from '@teamflow/ui';
import { RoleBadge } from '../role-badge';

export interface RoleChange {
  userId: string;
  role: AssignableWorkspaceRole;
}

/**
 * Dumb: renders members and emits intents. It only decides what to SHOW, using the
 * shared role rules; the API re-checks every action.
 */
@Component({
  selector: 'tf-member-list',
  imports: [RoleBadge, AvatarComponent, IconComponent],
  template: `
    <ul class="members">
      @for (member of members(); track member.userId) {
        <li class="member">
          <tf-avatar [name]="member.name" [size]="32" />
          <div class="member__who">
            <span class="member__name">
              {{ member.name }}
              @if (member.userId === currentUserId()) {
                <span class="member__you">(you)</span>
              }
            </span>
            <span class="member__email">{{ member.email }}</span>
          </div>

          @if (canManage(member)) {
            <label class="visually-hidden" [for]="'role-' + member.userId">
              Role for {{ member.name }}
            </label>
            <select
              class="member__role"
              [id]="'role-' + member.userId"
              [disabled]="busy()"
              (change)="onRoleSelected(member, $event)"
            >
              @for (role of assignableRoles(); track role) {
                <option [value]="role" [selected]="role === member.role">
                  {{ label(role) }}
                </option>
              }
            </select>
            <button
              type="button"
              class="member__remove"
              [attr.aria-label]="'Remove ' + member.name"
              title="Remove from workspace"
              [disabled]="busy()"
              (click)="remove.emit(member.userId)"
            >
              <tf-icon name="x" />
            </button>
          } @else {
            <tf-role-badge [role]="member.role" />
          }
        </li>
      }
    </ul>
  `,
  styles: `
    .members {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .member {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.5rem 0;
    }
    .member + .member {
      border-top: 1px solid var(--tf-color-border);
    }
    .member__who {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
      line-height: 1.3;
    }
    .member__name {
      overflow: hidden;
      font-weight: 600;
      font-size: 0.875rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .member__you,
    .member__email {
      color: var(--tf-color-text-muted);
      font-size: 0.75rem;
      font-weight: 400;
    }
    .member__email {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .member__role {
      width: auto;
      min-height: 1.875rem;
      padding: 0.125rem 1.75rem 0.125rem 0.5rem;
      font-size: 0.75rem;
    }
    .member__remove {
      display: grid;
      place-items: center;
      width: 1.75rem;
      height: 1.75rem;
      border: 0;
      border-radius: var(--tf-radius-sm);
      background: none;
      color: var(--tf-color-text-subtle);
      cursor: pointer;
    }
    .member__remove:hover:not(:disabled) {
      background: var(--tf-color-danger-surface);
      color: var(--tf-color-danger);
    }
    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberList {
  readonly members = input.required<MemberDto[]>();
  readonly actorRole = input.required<WorkspaceRole>();
  readonly currentUserId = input.required<string | null>();
  readonly assignableRoles =
    input.required<readonly AssignableWorkspaceRole[]>();
  readonly busy = input(false);

  readonly roleChange = output<RoleChange>();
  readonly remove = output<string>();

  protected label(role: string): string {
    return role.charAt(0) + role.slice(1).toLowerCase();
  }

  protected canManage(member: MemberDto): boolean {
    return (
      member.userId !== this.currentUserId() &&
      canManageMember(this.actorRole(), member.role)
    );
  }

  protected onRoleSelected(member: MemberDto, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const role = select.value as AssignableWorkspaceRole;
    if (role === member.role || !canAssignRole(this.actorRole(), role)) {
      select.value = member.role;
      return;
    }
    this.roleChange.emit({ userId: member.userId, role });
  }
}
