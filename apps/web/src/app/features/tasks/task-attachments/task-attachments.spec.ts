import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AttachmentDto, WorkspaceRole } from '@teamflow/shared';
import { of, throwError } from 'rxjs';
import {
  AttachmentsApi,
  NAVIGATE_TO_URL,
} from '../../../core/attachments/attachments.api';
import { TaskAttachments } from './task-attachments';

const ref = { workspaceId: 'ws-1', projectId: 'p-1', taskId: 't-1' };

const attachment = (id: string, uploaderId = 'me'): AttachmentDto => ({
  id,
  taskId: 't-1',
  fileName: `${id}.pdf`,
  contentType: 'application/pdf',
  size: 2048,
  uploader: { userId: uploaderId, name: 'Someone' },
  createdAt: '2026-01-01T00:00:00.000Z',
});

describe('TaskAttachments', () => {
  let fixture: ComponentFixture<TaskAttachments>;
  let api: Record<
    'list' | 'create' | 'uploadToStorage' | 'complete' | 'download' | 'delete',
    jest.Mock
  >;
  let navigate: jest.Mock;

  async function render(role: WorkspaceRole, files: AttachmentDto[] = []) {
    api.list.mockReturnValue(of(files));
    fixture = TestBed.createComponent(TaskAttachments);
    fixture.componentRef.setInput('taskRef', ref);
    fixture.componentRef.setInput('role', role);
    fixture.componentRef.setInput('currentUserId', 'me');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function choose(el: HTMLElement, file: File) {
    const input = el.querySelector<HTMLInputElement>('input[type=file]');
    if (!input) throw new Error('file input missing');
    Object.defineProperty(input, 'files', {
      value: [file],
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  beforeEach(() => {
    api = {
      list: jest.fn(),
      create: jest.fn(),
      uploadToStorage: jest.fn(),
      complete: jest.fn(),
      download: jest.fn(),
      delete: jest.fn(),
    };
    navigate = jest.fn();
    TestBed.configureTestingModule({
      imports: [TaskAttachments],
      providers: [
        { provide: AttachmentsApi, useValue: api },
        { provide: NAVIGATE_TO_URL, useValue: navigate },
      ],
    });
  });

  it('lists files with sizes', async () => {
    const el = await render('VIEWER', [attachment('a-1')]);

    expect(api.list).toHaveBeenCalledWith(ref);
    expect(el.textContent).toContain('a-1.pdf');
    expect(el.textContent).toContain('2.0 KB');
  });

  it('hides upload from viewers', async () => {
    const el = await render('VIEWER');

    expect(el.querySelector('input[type=file]')).toBeNull();
  });

  it('runs announce -> upload -> complete and adds the file', async () => {
    const el = await render('MEMBER');
    const upload = {
      url: 'http://s3/bucket/k',
      method: 'PUT' as const,
      headers: { 'Content-Type': 'application/pdf' },
    };
    api.create.mockReturnValue(of({ attachment: attachment('a-9'), upload }));
    api.uploadToStorage.mockReturnValue(of({ percent: 100 }, { done: true }));
    api.complete.mockReturnValue(of(attachment('a-9')));
    const file = new File(['%PDF'], 'report.pdf', { type: 'application/pdf' });

    choose(el, file);

    expect(api.create).toHaveBeenCalledWith(ref, {
      name: 'report.pdf',
      type: 'application/pdf',
      size: 4,
    });
    expect(api.uploadToStorage).toHaveBeenCalledWith(upload, file);
    expect(api.complete).toHaveBeenCalledWith(ref, 'a-9');
    expect(el.textContent).toContain('a-9.pdf');
  });

  it('rejects a disallowed type before contacting the API', async () => {
    const el = await render('MEMBER');

    choose(el, new File(['<script>'], 'x.html', { type: 'text/html' }));

    expect(api.create).not.toHaveBeenCalled();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'not allowed',
    );
  });

  it('rejects an empty file', async () => {
    const el = await render('MEMBER');

    choose(el, new File([], 'empty.txt', { type: 'text/plain' }));

    expect(api.create).not.toHaveBeenCalled();
    expect(el.textContent).toContain('between 1 byte');
  });

  it('explains a failed verification', async () => {
    const el = await render('MEMBER');
    api.create.mockReturnValue(
      of({
        attachment: attachment('a-9'),
        upload: { url: 'u', method: 'PUT', headers: {} },
      }),
    );
    api.uploadToStorage.mockReturnValue(of({ done: true }));
    api.complete.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 400 })),
    );

    choose(el, new File(['x'], 'a.txt', { type: 'text/plain' }));

    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'failed verification',
    );
    expect(el.querySelector('input[type=file]')).not.toBeNull();
  });

  it('downloads through a signed URL', async () => {
    const el = await render('VIEWER', [attachment('a-1')]);
    api.download.mockReturnValue(of({ url: 'http://s3/signed' }));

    el.querySelector<HTMLButtonElement>('.file__name')?.click();

    expect(api.download).toHaveBeenCalledWith(ref, 'a-1');
    expect(navigate).toHaveBeenCalledWith('http://s3/signed');
  });

  it('offers delete only on own files for members', async () => {
    const el = await render('MEMBER', [
      attachment('a-1', 'me'),
      attachment('a-2', 'bob'),
    ]);

    expect(el.querySelectorAll('.file__delete')).toHaveLength(1);
  });

  it('deletes after confirmation', async () => {
    const el = await render('MEMBER', [attachment('a-1')]);
    api.delete.mockReturnValue(of(null));
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    el.querySelector<HTMLButtonElement>('.file__delete')?.click();
    fixture.detectChanges();

    expect(api.delete).toHaveBeenCalledWith(ref, 'a-1');
    expect(el.querySelectorAll('.file')).toHaveLength(0);
  });
});
