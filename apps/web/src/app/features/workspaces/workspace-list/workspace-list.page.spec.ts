import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WorkspaceDto } from '@teamflow/shared';
import { of } from 'rxjs';
import { WorkspacesApi } from '../../../core/workspaces/workspaces.api';
import { WorkspaceListPage } from './workspace-list.page';

const ws = (id: string, name: string): WorkspaceDto => ({
  id,
  name,
  role: 'OWNER',
  createdAt: '2026-01-01T00:00:00.000Z',
});

describe('WorkspaceListPage', () => {
  let fixture: ComponentFixture<WorkspaceListPage>;
  let api: { list: jest.Mock; create: jest.Mock };

  async function render(workspaces: WorkspaceDto[]) {
    api.list.mockReturnValue(of(workspaces));
    fixture = TestBed.createComponent(WorkspaceListPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    api = { list: jest.fn(), create: jest.fn() };
    TestBed.configureTestingModule({
      imports: [WorkspaceListPage],
      providers: [provideRouter([]), { provide: WorkspacesApi, useValue: api }],
    });
  });

  it('links to each workspace', async () => {
    const el = await render([ws('ws-1', 'Acme')]);

    const link = el.querySelector<HTMLAnchorElement>('.workspace-card');
    expect(link?.textContent).toContain('Acme');
    expect(link?.getAttribute('href')).toBe('/workspaces/ws-1');
  });

  it('shows an empty state', async () => {
    const el = await render([]);

    expect(el.textContent).toContain('not in any workspace yet');
  });

  it('creates a workspace and keeps the list sorted', async () => {
    const el = await render([ws('ws-2', 'Zeta')]);
    api.create.mockReturnValue(of(ws('ws-1', 'Acme')));

    const input = el.querySelector<HTMLInputElement>('#workspace-name');
    if (!input) throw new Error('name input missing');
    input.value = 'Acme';
    input.dispatchEvent(new Event('input'));
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(api.create).toHaveBeenCalledWith('Acme');
    const names = Array.from(el.querySelectorAll('.workspace-card__name')).map(
      (n) => n.textContent?.trim(),
    );
    expect(names).toEqual(['Acme', 'Zeta']);
  });

  it('does not submit an empty name', async () => {
    const el = await render([]);

    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(api.create).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Give the workspace a name');
  });
});
