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
  imports: [RoleBadge],
  template: `
    <ul class="members">
      @for (member of members(); track member.userId) {
        <li class="member">
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
              [id]="'role-' + member.userId"
              [disabled]="busy()"
              (change)="onRoleSelected(member, $event)"
            >
              @for (role of assignableRoles(); track role) {
                <option [value]="role" [selected]="role === member.role">
                  {{ role.toLowerCase() }}
                </option>
              }
            </select>
            <button
              type="button"
              class="link-button"
              [disabled]="busy()"
              (click)="remove.emit(member.userId)"
            >
              Remove
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
      margin: 0;
      padding: 0;
      list-style: none;
      border: 1px solid var(--tf-color-border);
      border-radius: 8px;
      background: var(--tf-color-surface);
    }
    .member {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
    }
    .member + .member {
      border-top: 1px solid var(--tf-color-border);
    }
    .member__who {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
    }
    .member__name {
      font-weight: 600;
    }
    .member__you,
    .member__email {
      color: var(--tf-color-text-muted);
      font-size: 0.875rem;
      font-weight: 400;
      overflow-wrap: anywhere;
    }
    select {
      min-height: 2rem;
      border: 1px solid var(--tf-color-border);
      border-radius: var(--tf-radius);
      background: var(--tf-color-surface);
      color: var(--tf-color-text);
      font: inherit;
      text-transform: capitalize;
    }
    .link-button {
      border: 0;
      background: none;
      color: var(--tf-color-danger);
      font: inherit;
      cursor: pointer;
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
