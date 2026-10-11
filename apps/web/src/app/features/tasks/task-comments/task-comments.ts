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
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  canComment,
  canDeleteComment,
  canEditComment,
  COMMENT_MAX_LENGTH,
  CommentDto,
  WorkspaceRole,
} from '@teamflow/shared';
import { ButtonComponent } from '@teamflow/ui';
import { catchError, map, Observable, of, switchMap } from 'rxjs';
import { CommentsApi, TaskRef } from '../../../core/comments/comments.api';
import { httpErrorMessage } from '../../../core/http-error-message';
import { relativeTime } from '../../../core/relative-time';

/** Smart: one task's comment thread. Rendered inside the (dumb) task panel. */
@Component({
  selector: 'tf-task-comments',
  imports: [ReactiveFormsModule, FormsModule, ButtonComponent],
  templateUrl: './task-comments.html',
  styleUrl: './task-comments.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskComments implements OnInit {
  readonly taskRef = input.required<TaskRef>();
  readonly role = input.required<WorkspaceRole>();
  readonly currentUserId = input.required<string | null>();

  private readonly api = inject(CommentsApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly comments = signal<CommentDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected editText = '';

  protected readonly canWrite = computed(() => canComment(this.role()));
  protected readonly maxLength = COMMENT_MAX_LENGTH;
  protected readonly relativeTime = relativeTime;

  protected readonly form = inject(NonNullableFormBuilder).group({
    body: ['', [Validators.required, Validators.maxLength(COMMENT_MAX_LENGTH)]],
  });

  private readonly ref$ = toObservable(this.taskRef);

  ngOnInit(): void {
    this.ref$
      .pipe(
        switchMap((ref) =>
          this.api.list(ref).pipe(
            map((comments) => ({ comments })),
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
        this.comments.set(result.comments);
        this.error.set(null);
      });
  }

  /** Inserts or replaces a comment (also used for live updates from the board). */
  upsert(comment: CommentDto): void {
    if (comment.taskId !== this.taskRef().taskId) return;
    this.comments.update((list) =>
      list.some((c) => c.id === comment.id)
        ? list.map((c) => (c.id === comment.id ? comment : c))
        : [...list, comment],
    );
  }

  /** Removes a comment (also used for live updates from the board). */
  removeLocal(commentId: string): void {
    this.comments.update((list) => list.filter((c) => c.id !== commentId));
  }

  protected isAuthor(comment: CommentDto): boolean {
    return comment.author?.userId === this.currentUserId();
  }

  protected canEdit(comment: CommentDto): boolean {
    return canEditComment(this.role(), this.isAuthor(comment));
  }

  protected canDelete(comment: CommentDto): boolean {
    return canDeleteComment(this.role(), this.isAuthor(comment));
  }

  protected add(): void {
    const body = this.form.getRawValue().body.trim();
    if (!body) return;
    this.run(this.api.create(this.taskRef(), body), (comment) => {
      this.upsert(comment);
      this.form.reset();
    });
  }

  protected startEdit(comment: CommentDto): void {
    this.editingId.set(comment.id);
    this.editText = comment.body;
  }

  protected saveEdit(comment: CommentDto): void {
    const body = this.editText.trim();
    if (!body) return;
    this.run(this.api.update(this.taskRef(), comment.id, body), (updated) => {
      this.upsert(updated);
      this.editingId.set(null);
    });
  }

  protected remove(comment: CommentDto): void {
    if (!confirm('Delete this comment?')) return;
    this.run(this.api.delete(this.taskRef(), comment.id), () =>
      this.removeLocal(comment.id),
    );
  }

  private run<T>(request: Observable<T>, onSuccess: (value: T) => void): void {
    this.busy.set(true);
    this.error.set(null);
    request.subscribe({
      next: (value) => {
        onSuccess(value);
        this.busy.set(false);
      },
      error: (error: unknown) => {
        this.error.set(
          httpErrorMessage(error, { 403: 'Your role does not allow this.' }),
        );
        this.busy.set(false);
      },
    });
  }
}
