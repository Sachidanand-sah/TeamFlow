import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  ALLOWED_ATTACHMENT_TYPES,
  ATTACHMENT_MAX_BYTES,
  AttachmentDto,
  canDeleteAttachment,
  canUploadAttachment,
  formatFileSize,
  isAllowedAttachmentType,
  WorkspaceRole,
} from '@teamflow/shared';
import { IconComponent } from '@teamflow/ui';
import { catchError, concatMap, last, map, of, switchMap, tap } from 'rxjs';
import {
  AttachmentsApi,
  NAVIGATE_TO_URL,
} from '../../../core/attachments/attachments.api';
import { TaskRef } from '../../../core/comments/comments.api';
import { httpErrorMessage } from '../../../core/http-error-message';

/** Smart: a task's files. Upload goes browser -> storage, then the API verifies it. */
@Component({
  selector: 'tf-task-attachments',
  imports: [IconComponent],
  templateUrl: './task-attachments.html',
  styleUrl: './task-attachments.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskAttachments implements OnInit {
  readonly taskRef = input.required<TaskRef>();
  readonly role = input.required<WorkspaceRole>();
  readonly currentUserId = input.required<string | null>();

  private readonly api = inject(AttachmentsApi);
  private readonly navigate = inject(NAVIGATE_TO_URL);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly files = signal<AttachmentDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  /** null when idle; 0..100 while uploading. */
  protected readonly progress = signal<number | null>(null);

  protected readonly canUpload = computed(() =>
    canUploadAttachment(this.role()),
  );
  protected readonly accept = ALLOWED_ATTACHMENT_TYPES.join(',');
  protected readonly maxSize = formatFileSize(ATTACHMENT_MAX_BYTES);
  protected readonly formatFileSize = formatFileSize;

  private readonly ref$ = toObservable(this.taskRef);

  ngOnInit(): void {
    this.ref$
      .pipe(
        switchMap((ref) =>
          this.api.list(ref).pipe(
            map((files) => ({ files })),
            catchError((error: unknown) => of({ error })),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(false);
        if ('error' in result) {
          this.error.set(httpErrorMessage(result.error));
          return;
        }
        this.files.set(result.files);
      });
  }

  protected canDelete(file: AttachmentDto): boolean {
    return canDeleteAttachment(
      this.role(),
      file.uploader?.userId === this.currentUserId(),
    );
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow choosing the same file again
    if (!file) return;

    // Checked again by the API and by storage; this only saves a doomed upload.
    if (!isAllowedAttachmentType(file.type)) {
      this.error.set('This file type is not allowed.');
      return;
    }
    if (file.size === 0 || file.size > ATTACHMENT_MAX_BYTES) {
      this.error.set(`Files must be between 1 byte and ${this.maxSize}.`);
      return;
    }

    const ref = this.taskRef();
    const type = file.type;
    this.error.set(null);
    this.progress.set(0);
    this.api
      .create(ref, { name: file.name, type, size: file.size })
      .pipe(
        concatMap(({ attachment, upload }) =>
          this.api.uploadToStorage(upload, file).pipe(
            tap((p) => {
              if ('percent' in p) this.progress.set(p.percent);
            }),
            last(),
            concatMap(() => this.api.complete(ref, attachment.id)),
          ),
        ),
      )
      .subscribe({
        next: (attachment) => {
          this.files.update((list) => [...list, attachment]);
          this.progress.set(null);
        },
        error: (error: unknown) => {
          this.progress.set(null);
          this.error.set(
            httpErrorMessage(error, {
              400: 'The upload failed verification. Please try again.',
              403: 'Your role does not allow uploading files.',
            }),
          );
        },
      });
  }

  protected download(file: AttachmentDto): void {
    this.api.download(this.taskRef(), file.id).subscribe({
      next: ({ url }) => this.navigate(url),
      error: (error: unknown) => this.error.set(httpErrorMessage(error)),
    });
  }

  protected remove(file: AttachmentDto): void {
    if (!confirm(`Delete ${file.fileName}?`)) return;
    this.api.delete(this.taskRef(), file.id).subscribe({
      next: () =>
        this.files.update((list) => list.filter((f) => f.id !== file.id)),
      error: (error: unknown) => this.error.set(httpErrorMessage(error)),
    });
  }
}
