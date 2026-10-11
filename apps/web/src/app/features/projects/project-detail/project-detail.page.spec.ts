import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ProjectDto, WorkspaceDto, WorkspaceRole } from '@teamflow/shared';
import { of, throwError } from 'rxjs';
import { ActivityApi } from '../../../core/activity/activity.api';
import { AuthService } from '../../../core/auth/auth.service';
import { ProjectsApi } from '../../../core/projects/projects.api';
import { TasksApi } from '../../../core/tasks/tasks.api';
import { WorkspacesApi } from '../../../core/workspaces/workspaces.api';
import { ProjectDetailPage } from './project-detail.page';

const project: ProjectDto = {
  id: 'p-1',
  workspaceId: 'ws-1',
  key: 'WEB',
  name: 'Website',
  description: 'Marketing site',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const workspace = (role: WorkspaceRole): WorkspaceDto => ({
  id: 'ws-1',
  name: 'Acme',
  role,
  createdAt: '2026-01-01T00:00:00.000Z',
});

describe('ProjectDetailPage', () => {
  let fixture: ComponentFixture<ProjectDetailPage>;
  let projectsApi: { get: jest.Mock; update: jest.Mock; delete: jest.Mock };
  let workspacesApi: { get: jest.Mock; listMembers: jest.Mock };

  async function render(role: WorkspaceRole) {
    workspacesApi.get.mockReturnValue(of(workspace(role)));
    fixture = TestBed.createComponent(ProjectDetailPage);
    fixture.componentRef.setInput('workspaceId', 'ws-1');
    fixture.componentRef.setInput('projectId', 'p-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function clickButton(el: HTMLElement, label: string): void {
    Array.from(el.querySelectorAll('button'))
      .find((b) => b.textContent?.includes(label))
      ?.click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    projectsApi = {
      get: jest.fn().mockReturnValue(of(project)),
      update: jest.fn(),
      delete: jest.fn(),
    };
    workspacesApi = { get: jest.fn(), listMembers: jest.fn(() => of([])) };
    TestBed.configureTestingModule({
      imports: [ProjectDetailPage],
      providers: [
        provideRouter([]),
        { provide: ProjectsApi, useValue: projectsApi },
        { provide: WorkspacesApi, useValue: workspacesApi },
        // The embedded board has its own spec; here it renders an empty board.
        { provide: TasksApi, useValue: { list: () => of([]) } },
        {
          provide: ActivityApi,
          useValue: { list: () => of({ items: [], nextCursor: null }) },
        },
        { provide: AuthService, useValue: { user: signal(null) } },
      ],
    });
  });

  it('shows the project', async () => {
    const el = await render('VIEWER');

    expect(projectsApi.get).toHaveBeenCalledWith('ws-1', 'p-1');
    expect(el.querySelector('h1')?.textContent).toContain('Website');
    expect(el.querySelector('.key')?.textContent).toContain('WEB');
    expect(el.textContent).toContain('Marketing site');
    expect(el.textContent).toContain('← Acme');
  });

  it('hides edit and delete from non-admins', async () => {
    const el = await render('MEMBER');

    expect(el.textContent).not.toContain('Edit');
    expect(el.textContent).not.toContain('Delete project');
  });

  it('lets an admin edit name and clear the description', async () => {
    const el = await render('ADMIN');
    projectsApi.update.mockReturnValue(
      of({ ...project, name: 'Site', description: null }),
    );

    clickButton(el, 'Edit');
    const name = el.querySelector<HTMLInputElement>('#project-name');
    const description = el.querySelector<HTMLTextAreaElement>(
      '#project-description',
    );
    if (!name || !description) throw new Error('form not rendered');
    name.value = 'Site';
    name.dispatchEvent(new Event('input'));
    description.value = '   ';
    description.dispatchEvent(new Event('input'));
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(projectsApi.update).toHaveBeenCalledWith('ws-1', 'p-1', {
      name: 'Site',
      description: null,
    });
    expect(el.querySelector('h1')?.textContent).toContain('Site');
  });

  it('deletes after confirmation and returns to the workspace', async () => {
    const el = await render('ADMIN');
    projectsApi.delete.mockReturnValue(of(null));
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const navigate = jest
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);

    clickButton(el, 'Delete project');

    expect(projectsApi.delete).toHaveBeenCalledWith('ws-1', 'p-1');
    expect(navigate).toHaveBeenCalledWith(['/workspaces', 'ws-1']);
  });

  it('shows a not-found message', async () => {
    projectsApi.get.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 404 })),
    );
    const el = await render('ADMIN');

    expect(el.textContent).toContain(
      'does not exist or you do not have access',
    );
  });
});
