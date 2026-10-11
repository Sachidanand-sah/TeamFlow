import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommentDto, WorkspaceRole } from '@teamflow/shared';
import { of, throwError } from 'rxjs';
import { CommentsApi } from '../../../core/comments/comments.api';
import { TaskComments } from './task-comments';

const ref = { workspaceId: 'ws-1', projectId: 'p-1', taskId: 't-1' };

const comment = (
  id: string,
  authorId: string,
  body = `Comment ${id}`,
): CommentDto => ({
  id,
  taskId: 't-1',
  author: { userId: authorId, name: authorId === 'me' ? 'Me' : 'Bob' },
  body,
  editedAt: null,
  createdAt: new Date().toISOString(),
});

describe('TaskComments', () => {
  let fixture: ComponentFixture<TaskComments>;
  let api: {
    list: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  async function render(role: WorkspaceRole, comments: CommentDto[]) {
    api.list.mockReturnValue(of(comments));
    fixture = TestBed.createComponent(TaskComments);
    fixture.componentRef.setInput('taskRef', ref);
    fixture.componentRef.setInput('role', role);
    fixture.componentRef.setInput('currentUserId', 'me');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const buttons = (el: HTMLElement, label: string) =>
    Array.from(el.querySelectorAll('button')).filter((b) =>
      b.textContent?.trim().startsWith(label),
    );

  beforeEach(() => {
    api = {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    TestBed.configureTestingModule({
      imports: [TaskComments],
      providers: [{ provide: CommentsApi, useValue: api }],
    });
  });

  it('shows the thread and renders bodies as text, not HTML', async () => {
    const el = await render('VIEWER', [
      comment('c-1', 'bob', '<img src=x onerror=alert(1)>'),
    ]);

    expect(api.list).toHaveBeenCalledWith(ref);
    expect(el.querySelector('.comment__body')?.textContent).toContain('<img');
    expect(el.querySelector('.comment__body img')).toBeNull();
  });

  it('is read-only for viewers', async () => {
    const el = await render('VIEWER', [comment('c-1', 'me')]);

    expect(el.querySelector('#new-comment')).toBeNull();
    expect(buttons(el, 'Edit')).toHaveLength(0);
  });

  it('offers edit/delete on own comments only (MEMBER)', async () => {
    const el = await render('MEMBER', [
      comment('c-1', 'me'),
      comment('c-2', 'bob'),
    ]);

    expect(buttons(el, 'Edit')).toHaveLength(1);
    expect(buttons(el, 'Delete')).toHaveLength(1);
  });

  it("lets admins delete others' comments but not edit them", async () => {
    const el = await render('ADMIN', [comment('c-2', 'bob')]);

    expect(buttons(el, 'Edit')).toHaveLength(0);
    expect(buttons(el, 'Delete')).toHaveLength(1);
  });

  it('adds a comment', async () => {
    const el = await render('MEMBER', []);
    api.create.mockReturnValue(of(comment('c-9', 'me', 'Ship it')));

    const box = el.querySelector<HTMLTextAreaElement>('#new-comment');
    if (!box) throw new Error('missing textarea');
    box.value = ' Ship it ';
    box.dispatchEvent(new Event('input'));
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(api.create).toHaveBeenCalledWith(ref, 'Ship it');
    expect(el.textContent).toContain('Ship it');
    expect(box.value).toBe('');
  });

  it('edits a comment', async () => {
    const el = await render('MEMBER', [comment('c-1', 'me', 'Old')]);
    api.update.mockReturnValue(
      of({
        ...comment('c-1', 'me', 'New'),
        editedAt: new Date().toISOString(),
      }),
    );

    buttons(el, 'Edit')[0].click();
    fixture.detectChanges();
    await fixture.whenStable();
    const box = el.querySelector<HTMLTextAreaElement>('#edit-c-1');
    if (!box) throw new Error('edit box missing');
    box.value = 'New';
    box.dispatchEvent(new Event('input'));
    buttons(el, 'Save')[0].click();
    fixture.detectChanges();

    expect(api.update).toHaveBeenCalledWith(ref, 'c-1', 'New');
    expect(el.querySelector('.comment__body')?.textContent).toContain('New');
    expect(el.textContent).toContain('edited');
  });

  it('deletes after confirmation', async () => {
    const el = await render('MEMBER', [comment('c-1', 'me')]);
    api.delete.mockReturnValue(of(null));
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    buttons(el, 'Delete')[0].click();
    fixture.detectChanges();

    expect(api.delete).toHaveBeenCalledWith(ref, 'c-1');
    expect(el.querySelectorAll('.comment')).toHaveLength(0);
  });

  it('shows an error when posting fails', async () => {
    const el = await render('MEMBER', []);
    api.create.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 403 })),
    );

    const box = el.querySelector<HTMLTextAreaElement>('#new-comment');
    if (!box) throw new Error('missing textarea');
    box.value = 'Hi';
    box.dispatchEvent(new Event('input'));
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Your role does not allow this',
    );
  });

  it('applies live upserts and removals for this task only', async () => {
    const el = await render('VIEWER', []);

    fixture.componentInstance.upsert(comment('c-5', 'bob', 'Live'));
    fixture.componentInstance.upsert({
      ...comment('c-6', 'bob'),
      taskId: 'other',
    });
    fixture.detectChanges();
    expect(el.querySelectorAll('.comment')).toHaveLength(1);

    fixture.componentInstance.removeLocal('c-5');
    fixture.detectChanges();
    expect(el.querySelectorAll('.comment')).toHaveLength(0);
  });
});
