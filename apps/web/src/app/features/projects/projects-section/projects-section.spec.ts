import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProjectDto, WorkspaceRole } from '@teamflow/shared';
import { of, throwError } from 'rxjs';
import { ProjectsApi } from '../../../core/projects/projects.api';
import { ProjectsSection } from './projects-section';

const project = (id: string, key: string, name: string): ProjectDto => ({
  id,
  workspaceId: 'ws-1',
  key,
  name,
  description: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('ProjectsSection', () => {
  let fixture: ComponentFixture<ProjectsSection>;
  let api: { list: jest.Mock; create: jest.Mock };

  async function render(role: WorkspaceRole, projects: ProjectDto[] = []) {
    api.list.mockReturnValue(of(projects));
    fixture = TestBed.createComponent(ProjectsSection);
    fixture.componentRef.setInput('workspaceId', 'ws-1');
    fixture.componentRef.setInput('role', role);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function type(el: HTMLElement, selector: string, value: string): void {
    const input = el.querySelector<HTMLInputElement>(selector);
    if (!input) throw new Error(`${selector} missing`);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function openForm(el: HTMLElement): void {
    Array.from(el.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('New project'))
      ?.click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    api = { list: jest.fn(), create: jest.fn() };
    TestBed.configureTestingModule({
      imports: [ProjectsSection],
      providers: [provideRouter([]), { provide: ProjectsApi, useValue: api }],
    });
  });

  it('lists projects with links to their pages', async () => {
    const el = await render('VIEWER', [project('p-1', 'WEB', 'Website')]);

    expect(api.list).toHaveBeenCalledWith('ws-1');
    const link = el.querySelector<HTMLAnchorElement>('.project');
    expect(link?.textContent).toContain('WEB');
    expect(link?.getAttribute('href')).toBe('/workspaces/ws-1/projects/p-1');
  });

  it('hides "New project" from non-admins', async () => {
    const el = await render('MEMBER');

    expect(el.textContent).not.toContain('New project');
    expect(el.textContent).toContain('An admin can create the first one');
  });

  it('suggests a key from the name until the user edits the key', async () => {
    const el = await render('ADMIN');
    openForm(el);

    type(el, '#project-name', 'Team Flow web');
    expect(el.querySelector<HTMLInputElement>('#project-key')?.value).toBe(
      'TFW',
    );

    const keyInput = el.querySelector<HTMLInputElement>('#project-key');
    if (!keyInput) throw new Error('key input missing');
    keyInput.value = 'tf';
    keyInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    type(el, '#project-name', 'Something else');

    expect(keyInput.value).toBe('TF');
  });

  it('creates a project and adds it to the list', async () => {
    const el = await render('ADMIN');
    api.create.mockReturnValue(of(project('p-2', 'MKT', 'Marketing')));
    openForm(el);

    type(el, '#project-name', 'Marketing');
    type(el, '#project-key', 'MKT');
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(api.create).toHaveBeenCalledWith('ws-1', {
      name: 'Marketing',
      key: 'MKT',
      description: null,
    });
    expect(el.querySelector('.project__name')?.textContent).toContain(
      'Marketing',
    );
    expect(el.querySelector('form')).toBeNull();
  });

  it('explains a duplicate key', async () => {
    const el = await render('ADMIN');
    api.create.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409 })),
    );
    openForm(el);

    type(el, '#project-name', 'Website');
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'The key WEB is already used',
    );
  });

  it('rejects an invalid key without calling the API', async () => {
    const el = await render('ADMIN');
    openForm(el);

    type(el, '#project-name', 'Website');
    type(el, '#project-key', '1X');
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(api.create).not.toHaveBeenCalled();
    expect(el.textContent).toContain('2-10 characters');
  });
});
