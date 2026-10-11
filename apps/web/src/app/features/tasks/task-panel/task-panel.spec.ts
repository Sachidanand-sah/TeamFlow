import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  MemberDto,
  TaskDto,
  TaskStatus,
  UpdateTaskRequest,
} from '@teamflow/shared';
import { TaskPanel } from './task-panel';

const task: TaskDto = {
  id: 't-1',
  projectId: 'p-1',
  number: 3,
  key: 'WEB-3',
  title: 'Fix login',
  description: 'Steps',
  status: 'TODO',
  priority: 'HIGH',
  position: 0,
  assignee: { userId: 'bob', name: 'Bob' },
  reporter: { userId: 'me', name: 'Me' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const members: MemberDto[] = ['me', 'bob'].map((id) => ({
  userId: id,
  name: id === 'me' ? 'Me' : 'Bob',
  email: `${id}@example.com`,
  role: 'MEMBER',
  joinedAt: '2026-01-01T00:00:00.000Z',
}));

describe('TaskPanel', () => {
  let fixture: ComponentFixture<TaskPanel>;
  let el: HTMLElement;

  function render(canEdit: boolean, current: TaskDto = task) {
    fixture = TestBed.createComponent(TaskPanel);
    fixture.componentRef.setInput('task', current);
    fixture.componentRef.setInput('members', members);
    fixture.componentRef.setInput('canEdit', canEdit);
    fixture.componentRef.setInput('canDelete', canEdit);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  const field = <T extends HTMLElement>(selector: string): T => {
    const found = el.querySelector<T>(selector);
    if (!found) throw new Error(`${selector} missing`);
    return found;
  };

  it('shows the task in the form', () => {
    render(true);

    expect(field<HTMLInputElement>('#task-title').value).toBe('Fix login');
    expect(field<HTMLSelectElement>('#task-priority').value).toBe('HIGH');
    expect(field<HTMLSelectElement>('#task-assignee').value).toBe('bob');
    expect(field<HTMLSelectElement>('#task-status').value).toBe('TODO');
    expect(el.textContent).toContain('Reported by Me');
  });

  it('emits the edited fields, mapping "Unassigned" and blank description to null', () => {
    render(true);
    const saved: UpdateTaskRequest[] = [];
    fixture.componentInstance.save.subscribe((s) => saved.push(s));

    const assignee = field<HTMLSelectElement>('#task-assignee');
    assignee.value = '';
    assignee.dispatchEvent(new Event('change'));
    const description = field<HTMLTextAreaElement>('#task-description');
    description.value = '  ';
    description.dispatchEvent(new Event('input'));
    field('form').dispatchEvent(new Event('submit'));

    expect(saved).toEqual([
      {
        title: 'Fix login',
        description: null,
        priority: 'HIGH',
        assigneeId: null,
      },
    ]);
  });

  it('does not emit save for an empty title', () => {
    render(true);
    const saved: UpdateTaskRequest[] = [];
    fixture.componentInstance.save.subscribe((s) => saved.push(s));

    const title = field<HTMLInputElement>('#task-title');
    title.value = '';
    title.dispatchEvent(new Event('input'));
    field('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(saved).toEqual([]);
    expect(el.textContent).toContain('A title is required');
  });

  it('emits a status change from the select', () => {
    render(true);
    const changes: TaskStatus[] = [];
    fixture.componentInstance.statusChange.subscribe((s) => changes.push(s));

    const status = field<HTMLSelectElement>('#task-status');
    status.value = 'DONE';
    status.dispatchEvent(new Event('change'));

    expect(changes).toEqual(['DONE']);
  });

  it('is read-only without edit rights', () => {
    render(false);

    expect(field<HTMLInputElement>('#task-title').disabled).toBe(true);
    expect(field<HTMLSelectElement>('#task-status').disabled).toBe(true);
    expect(el.querySelector('.panel__actions')).toBeNull();
  });

  it('closes on Escape and on the close button', () => {
    render(true);
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    field<HTMLButtonElement>('.panel__close').click();

    expect(closed).toBe(2);
  });

  it('keeps unsaved edits when the same task version is re-rendered', () => {
    render(true);
    const title = field<HTMLInputElement>('#task-title');
    title.value = 'Typing…';
    title.dispatchEvent(new Event('input'));

    // e.g. an optimistic reorder: new object, same id and updatedAt.
    fixture.componentRef.setInput('task', { ...task, position: 5 });
    fixture.detectChanges();

    expect(title.value).toBe('Typing…');
  });
});
