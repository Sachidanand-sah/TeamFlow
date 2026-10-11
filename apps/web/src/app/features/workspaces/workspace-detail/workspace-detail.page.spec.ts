import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MemberDto, WorkspaceDto, WorkspaceRole } from '@teamflow/shared';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { ProjectsApi } from '../../../core/projects/projects.api';
import { WorkspacesApi } from '../../../core/workspaces/workspaces.api';
import { WorkspaceDetailPage } from './workspace-detail.page';

const workspace = (role: WorkspaceRole): WorkspaceDto => ({
  id: 'ws-1',
  name: 'Acme',
  role,
  createdAt: '2026-01-01T00:00:00.000Z',
});

const me: MemberDto = {
  userId: 'me',
  name: 'Me',
  email: 'me@example.com',
  role: 'ADMIN',
  joinedAt: '2026-01-01T00:00:00.000Z',
};

describe('WorkspaceDetailPage', () => {
  let fixture: ComponentFixture<WorkspaceDetailPage>;
  let api: Record<keyof WorkspacesApi, jest.Mock>;

  async function render(role: WorkspaceRole) {
    api.get.mockReturnValue(of(workspace(role)));
    api.listMembers.mockReturnValue(of([{ ...me, role }]));
    fixture = TestBed.createComponent(WorkspaceDetailPage);
    fixture.componentRef.setInput('workspaceId', 'ws-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    api = {
      list: jest.fn(),
      create: jest.fn(),
      get: jest.fn(),
      rename: jest.fn(),
      delete: jest.fn(),
      listMembers: jest.fn(),
      addMember: jest.fn(),
      changeRole: jest.fn(),
      removeMember: jest.fn(),
    };
    TestBed.configureTestingModule({
      imports: [WorkspaceDetailPage],
      providers: [
        provideRouter([]),
        { provide: WorkspacesApi, useValue: api },
        // The embedded projects section has its own spec; here it just renders empty.
        { provide: ProjectsApi, useValue: { list: () => of([]) } },
        {
          provide: AuthService,
          useValue: {
            user: signal({ id: 'me', name: 'Me', email: 'me@example.com' }),
          },
        },
      ],
    });
  });

  it('loads the workspace and its members', async () => {
    const el = await render('VIEWER');

    expect(api.get).toHaveBeenCalledWith('ws-1');
    expect(api.listMembers).toHaveBeenCalledWith('ws-1');
    expect(el.querySelector('h1')?.textContent).toContain('Acme');
    expect(el.textContent).toContain('me@example.com');
  });

  it('hides admin tools from a VIEWER, who can only leave', async () => {
    const el = await render('VIEWER');

    expect(el.querySelector('#member-email')).toBeNull();
    expect(el.querySelector('#workspace-name')).toBeNull();
    expect(el.textContent).toContain('Leave workspace');
    expect(el.textContent).not.toContain('Delete workspace');
  });

  it('shows member and rename tools to an ADMIN', async () => {
    const el = await render('ADMIN');

    expect(el.querySelector('#member-email')).not.toBeNull();
    expect(el.querySelector('#workspace-name')).not.toBeNull();
    const roleOptions = Array.from(
      el.querySelectorAll<HTMLOptionElement>('#member-role option'),
    ).map((o) => o.value);
    expect(roleOptions).toEqual(['MEMBER', 'VIEWER']);
  });

  it('offers deletion (not leaving) to the OWNER', async () => {
    const el = await render('OWNER');

    expect(el.textContent).toContain('Delete workspace');
    expect(el.textContent).not.toContain('Leave workspace');
  });

  it('adds a member and shows them in the list', async () => {
    const el = await render('ADMIN');
    api.addMember.mockReturnValue(
      of({
        ...me,
        userId: 'bob',
        name: 'Bob',
        email: 'bob@example.com',
        role: 'MEMBER',
      }),
    );

    const input = el.querySelector<HTMLInputElement>('#member-email');
    if (!input) throw new Error('email input missing');
    input.value = 'bob@example.com';
    input.dispatchEvent(new Event('input'));
    el.querySelector<HTMLFormElement>('form')?.dispatchEvent(
      new Event('submit'),
    );
    fixture.detectChanges();

    expect(api.addMember).toHaveBeenCalledWith('ws-1', {
      email: 'bob@example.com',
      role: 'MEMBER',
    });
    expect(el.textContent).toContain('bob@example.com');
  });

  it('explains a failed add', async () => {
    const el = await render('ADMIN');
    api.addMember.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409 })),
    );

    const input = el.querySelector<HTMLInputElement>('#member-email');
    if (!input) throw new Error('email input missing');
    input.value = 'me@example.com';
    input.dispatchEvent(new Event('input'));
    el.querySelector<HTMLFormElement>('form')?.dispatchEvent(
      new Event('submit'),
    );
    fixture.detectChanges();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'already a member',
    );
  });

  it('shows a not-found message for workspaces the user cannot see', async () => {
    api.get.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 404 })),
    );
    api.listMembers.mockReturnValue(of([]));
    fixture = TestBed.createComponent(WorkspaceDetailPage);
    fixture.componentRef.setInput('workspaceId', 'ws-404');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'does not exist or you are not a member',
    );
  });

  it('navigates home after the owner confirms deletion', async () => {
    const el = await render('OWNER');
    api.delete.mockReturnValue(of(null));
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const navigate = jest
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockResolvedValue(true);

    const deleteButton = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Delete workspace'),
    );
    deleteButton?.click();

    expect(api.delete).toHaveBeenCalledWith('ws-1');
    expect(navigate).toHaveBeenCalledWith('/');
  });
});
