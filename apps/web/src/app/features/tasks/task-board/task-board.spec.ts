import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  MemberDto,
  TaskDto,
  TaskStatus,
  WorkspaceRole,
} from '@teamflow/shared';
import { of, Subject, throwError } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { TasksApi } from '../../../core/tasks/tasks.api';
import { WorkspacesApi } from '../../../core/workspaces/workspaces.api';
import { TaskBoard } from './task-board';

function task(
  id: string,
  status: TaskStatus,
  position: number,
  reporterId = 'me',
): TaskDto {
  return {
    id,
    projectId: 'p-1',
    number: Number(id.replace(/\D/g, '')) || 1,
    key: `WEB-${id}`,
    title: `Task ${id}`,
    description: null,
    status,
    priority: 'MEDIUM',
    position,
    assignee: null,
    reporter: { userId: reporterId, name: 'Someone' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const members: MemberDto[] = [
  {
    userId: 'me',
    name: 'Me',
    email: 'me@example.com',
    role: 'MEMBER',
    joinedAt: '2026-01-01T00:00:00.000Z',
  },
];

type Api = Record<keyof TasksApi, jest.Mock>;

describe('TaskBoard', () => {
  let fixture: ComponentFixture<TaskBoard>;
  let api: Api;

  async function render(role: WorkspaceRole, tasks: TaskDto[]) {
    api.list.mockReturnValue(of(tasks));
    fixture = TestBed.createComponent(TaskBoard);
    fixture.componentRef.setInput('workspaceId', 'ws-1');
    fixture.componentRef.setInput('projectId', 'p-1');
    fixture.componentRef.setInput('role', role);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function columnTitles(el: HTMLElement, status: TaskStatus): string[] {
    const column = el
      .querySelector(`#column-${status}`)
      ?.closest('section') as HTMLElement;
    return Array.from(column.querySelectorAll('.card__title')).map(
      (n) => n.textContent?.trim() ?? '',
    );
  }

  /** Simulates CDK's drop event (CDK's real drag needs pointer events and layout). */
  function drop(
    item: TaskDto,
    from: TaskStatus,
    to: TaskStatus,
    index: number,
  ) {
    const board = fixture.componentInstance as unknown as {
      onDrop(e: CdkDragDrop<TaskStatus, TaskStatus, TaskDto>): void;
    };
    board.onDrop({
      item: { data: item },
      previousContainer: { data: from },
      container: { data: to },
      previousIndex: item.position,
      currentIndex: index,
    } as unknown as CdkDragDrop<TaskStatus, TaskStatus, TaskDto>);
    fixture.detectChanges();
  }

  beforeEach(() => {
    api = {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      move: jest.fn(),
      delete: jest.fn(),
    };
    TestBed.configureTestingModule({
      imports: [TaskBoard],
      providers: [
        { provide: TasksApi, useValue: api },
        {
          provide: WorkspacesApi,
          useValue: { listMembers: () => of(members) },
        },
        {
          provide: AuthService,
          useValue: {
            user: signal({ id: 'me', name: 'Me', email: 'me@example.com' }),
          },
        },
      ],
    });
  });

  it('renders tasks in their columns, ordered by position', async () => {
    const el = await render('VIEWER', [
      task('2', 'TODO', 1),
      task('1', 'TODO', 0),
      task('3', 'DONE', 0),
    ]);

    expect(api.list).toHaveBeenCalledWith('ws-1', 'p-1');
    expect(columnTitles(el, 'TODO')).toEqual(['Task 1', 'Task 2']);
    expect(columnTitles(el, 'DONE')).toEqual(['Task 3']);
    expect(columnTitles(el, 'IN_PROGRESS')).toEqual([]);
  });

  it('moves a card immediately and sends the move to the API', async () => {
    const t1 = task('1', 'TODO', 0);
    const el = await render('MEMBER', [t1, task('2', 'TODO', 1)]);
    const response = new Subject<TaskDto>();
    api.move.mockReturnValue(response);

    drop(t1, 'TODO', 'IN_PROGRESS', 0);

    // Optimistic: already moved before the server answered.
    expect(columnTitles(el, 'IN_PROGRESS')).toEqual(['Task 1']);
    expect(columnTitles(el, 'TODO')).toEqual(['Task 2']);
    expect(api.move).toHaveBeenCalledWith('ws-1', 'p-1', '1', {
      status: 'IN_PROGRESS',
      index: 0,
    });

    response.next({ ...t1, status: 'IN_PROGRESS', position: 0 });
    fixture.detectChanges();
    expect(columnTitles(el, 'IN_PROGRESS')).toEqual(['Task 1']);
  });

  it('rolls the move back and explains when the API rejects it', async () => {
    const t1 = task('1', 'TODO', 0);
    const el = await render('MEMBER', [t1]);
    api.move.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 403 })),
    );

    drop(t1, 'TODO', 'DONE', 0);

    expect(columnTitles(el, 'TODO')).toEqual(['Task 1']);
    expect(columnTitles(el, 'DONE')).toEqual([]);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Your role does not allow this',
    );
  });

  it('ignores a drop in the same place', async () => {
    const t1 = task('1', 'TODO', 0);
    await render('MEMBER', [t1]);

    drop(t1, 'TODO', 'TODO', 0);

    expect(api.move).not.toHaveBeenCalled();
  });

  it('quick-adds a task to To do', async () => {
    const el = await render('MEMBER', []);
    api.create.mockReturnValue(of(task('9', 'TODO', 0)));

    const input = el.querySelector<HTMLInputElement>('#quick-add-title');
    if (!input) throw new Error('quick add missing');
    input.value = 'Task 9';
    input.dispatchEvent(new Event('input'));
    el.querySelector('.quick-add')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(api.create).toHaveBeenCalledWith('ws-1', 'p-1', { title: 'Task 9' });
    expect(columnTitles(el, 'TODO')).toEqual(['Task 9']);
    expect(input.value).toBe('');
  });

  it('is read-only for viewers', async () => {
    const el = await render('VIEWER', [task('1', 'TODO', 0)]);

    expect(el.querySelector('#quick-add-title')).toBeNull();
    expect(el.querySelector('.cdk-drop-list-disabled')).not.toBeNull();
  });

  it('opens the panel for a card and saves changes', async () => {
    const t1 = task('1', 'TODO', 0);
    const el = await render('MEMBER', [t1]);
    api.update.mockReturnValue(of({ ...t1, title: 'Renamed' }));

    el.querySelector<HTMLElement>('tf-task-card')?.click();
    fixture.detectChanges();
    const title = el.querySelector<HTMLInputElement>('#task-title');
    if (!title) throw new Error('panel not open');
    title.value = 'Renamed';
    title.dispatchEvent(new Event('input'));
    el.querySelector('.panel__form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(api.update).toHaveBeenCalledWith('ws-1', 'p-1', '1', {
      title: 'Renamed',
      description: null,
      priority: 'MEDIUM',
      assigneeId: null,
    });
    expect(columnTitles(el, 'TODO')).toEqual(['Renamed']);
  });

  it("offers delete only for the reporter's own task (MEMBER)", async () => {
    const el = await render('MEMBER', [
      task('1', 'TODO', 0, 'me'),
      task('2', 'TODO', 1, 'bob'),
    ]);
    const cards = el.querySelectorAll<HTMLElement>('tf-task-card');
    const hasDelete = () =>
      Array.from(el.querySelectorAll('.panel button')).some((b) =>
        b.textContent?.includes('Delete'),
      );

    cards[0].click();
    fixture.detectChanges();
    expect(hasDelete()).toBe(true);

    cards[1].click();
    fixture.detectChanges();
    expect(hasDelete()).toBe(false);
  });

  it('deletes the selected task after confirmation', async () => {
    const el = await render('MEMBER', [task('1', 'TODO', 0)]);
    api.delete.mockReturnValue(of(null));
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    el.querySelector<HTMLElement>('tf-task-card')?.click();
    fixture.detectChanges();
    Array.from(el.querySelectorAll<HTMLButtonElement>('.panel button'))
      .find((b) => b.textContent?.includes('Delete'))
      ?.click();
    fixture.detectChanges();

    expect(api.delete).toHaveBeenCalledWith('ws-1', 'p-1', '1');
    expect(columnTitles(el, 'TODO')).toEqual([]);
    expect(el.querySelector('.panel')).toBeNull();
  });
});
