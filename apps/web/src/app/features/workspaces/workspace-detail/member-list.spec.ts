import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ASSIGNABLE_WORKSPACE_ROLES,
  canAssignRole,
  MemberDto,
  WorkspaceRole,
} from '@teamflow/shared';
import { MemberList, RoleChange } from './member-list';

function member(userId: string, role: WorkspaceRole): MemberDto {
  return {
    userId,
    name: `User ${userId}`,
    email: `${userId}@example.com`,
    role,
    joinedAt: '2026-01-01T00:00:00.000Z',
  };
}

const members = [
  member('owner', 'OWNER'),
  member('admin', 'ADMIN'),
  member('alice', 'MEMBER'),
];

describe('MemberList', () => {
  let fixture: ComponentFixture<MemberList>;

  function render(actorRole: WorkspaceRole, currentUserId: string) {
    fixture = TestBed.createComponent(MemberList);
    fixture.componentRef.setInput('members', members);
    fixture.componentRef.setInput('actorRole', actorRole);
    fixture.componentRef.setInput('currentUserId', currentUserId);
    fixture.componentRef.setInput(
      'assignableRoles',
      ASSIGNABLE_WORKSPACE_ROLES.filter((r) => canAssignRole(actorRole, r)),
    );
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows controls only for members the actor outranks', () => {
    const el = render('ADMIN', 'admin');

    expect(el.querySelector('#role-owner')).toBeNull();
    expect(el.querySelector('#role-admin')).toBeNull(); // yourself
    expect(el.querySelector('#role-alice')).not.toBeNull();
    expect(el.textContent).toContain('(you)');
  });

  it('shows no controls at all to a MEMBER', () => {
    const el = render('MEMBER', 'alice');

    expect(el.querySelectorAll('select')).toHaveLength(0);
    expect(el.querySelectorAll('button')).toHaveLength(0);
  });

  it('preselects the current role and offers only assignable roles', () => {
    const select = render('ADMIN', 'admin').querySelector<HTMLSelectElement>(
      '#role-alice',
    );

    expect(select?.value).toBe('MEMBER');
    expect(Array.from(select?.options ?? []).map((o) => o.value)).toEqual([
      'MEMBER',
      'VIEWER',
    ]);
  });

  it('emits a role change', () => {
    const el = render('OWNER', 'owner');
    const changes: RoleChange[] = [];
    fixture.componentInstance.roleChange.subscribe((c) => changes.push(c));

    const select = el.querySelector<HTMLSelectElement>('#role-alice');
    if (!select) throw new Error('select not rendered');
    select.value = 'VIEWER';
    select.dispatchEvent(new Event('change'));

    expect(changes).toEqual([{ userId: 'alice', role: 'VIEWER' }]);
  });

  it('emits remove with the user id', () => {
    const el = render('OWNER', 'owner');
    const removed: string[] = [];
    fixture.componentInstance.remove.subscribe((id) => removed.push(id));

    const buttons = el.querySelectorAll<HTMLButtonElement>('button');
    buttons[buttons.length - 1].click();

    expect(removed).toEqual(['alice']);
  });
});
