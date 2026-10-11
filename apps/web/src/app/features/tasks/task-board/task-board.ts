import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  CdkDropListGroup,
} from '@angular/cdk/drag-drop';
import { IconComponent } from '@teamflow/ui';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  canDeleteTask,
  canEditTasks,
  MemberDto,
  moveTask,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  TASK_TITLE_MAX_LENGTH,
  TaskDto,
  TaskStatus,
  UpdateTaskRequest,
  WorkspaceRole,
} from '@teamflow/shared';
import { catchError, forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { TaskRef } from '../../../core/comments/comments.api';
import { httpErrorMessage } from '../../../core/http-error-message';
import {
  BoardStreamEvent,
  RealtimeService,
} from '../../../core/realtime/realtime.service';
import { TasksApi } from '../../../core/tasks/tasks.api';
import { WorkspacesApi } from '../../../core/workspaces/workspaces.api';
import { TaskAttachments } from '../task-attachments/task-attachments';
import { TaskCard } from '../task-card';
import { TaskComments } from '../task-comments/task-comments';
import { TaskPanel } from '../task-panel/task-panel';

const TASK_ERRORS = {
  400: 'That person is not a member of this workspace.',
  403: 'Your role does not allow this.',
  404: 'This task no longer exists. Reload the page.',
};

/**
 * Smart: owns the board state (tasks + members) and every task action.
 *
 * Moves are OPTIMISTIC: the card moves immediately using the shared `moveTask`
 * (the same ordering the API applies), then the request is sent. If it fails, the
 * previous board is restored. WHY: dragging must feel instant; waiting ~100 ms for the
 * server before the card lands would feel broken.
 */
@Component({
  selector: 'tf-task-board',
  imports: [
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    ReactiveFormsModule,
    IconComponent,
    TaskAttachments,
    TaskCard,
    TaskComments,
    TaskPanel,
  ],
  templateUrl: './task-board.html',
  styleUrl: './task-board.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskBoard implements OnInit {
  readonly workspaceId = input.required<string>();
  readonly projectId = input.required<string>();
  readonly role = input.required<WorkspaceRole>();

  private readonly api = inject(TasksApi);
  private readonly workspacesApi = inject(WorkspacesApi);
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  /** The open panel's comment thread, to forward live comment events to. */
  private readonly comments = viewChild(TaskComments);

  protected readonly statuses = TASK_STATUSES;
  protected readonly labels = TASK_STATUS_LABELS;

  protected readonly tasks = signal<TaskDto[]>([]);
  protected readonly members = signal<MemberDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly boardError = signal<string | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly panelBusy = signal(false);
  protected readonly panelError = signal<string | null>(null);
  protected readonly adding = signal(false);

  protected readonly canEdit = computed(() => canEditTasks(this.role()));
  protected readonly currentUserId = computed(
    () => this.auth.user()?.id ?? null,
  );

  /** Tasks grouped by column, each sorted by position. */
  protected readonly columns = computed(() => {
    const grouped = Object.fromEntries(
      TASK_STATUSES.map((s) => [s, [] as TaskDto[]]),
    ) as Record<TaskStatus, TaskDto[]>;
    for (const task of this.tasks()) {
      grouped[task.status].push(task);
    }
    for (const status of TASK_STATUSES) {
      grouped[status].sort((a, b) => a.position - b.position);
    }
    return grouped;
  });

  protected readonly selected = computed(
    () => this.tasks().find((t) => t.id === this.selectedId()) ?? null,
  );
  /** Changes only when another task is selected, so comments reload only then. */
  protected readonly selectedRef = computed<TaskRef | null>(() => {
    const taskId = this.selectedId();
    return taskId
      ? { workspaceId: this.workspaceId(), projectId: this.projectId(), taskId }
      : null;
  });
  protected readonly canDeleteSelected = computed(() => {
    const task = this.selected();
    return (
      task !== null &&
      canDeleteTask(this.role(), task.reporter?.userId === this.auth.user()?.id)
    );
  });

  protected readonly quickAdd = inject(NonNullableFormBuilder).group({
    title: [
      '',
      [Validators.required, Validators.maxLength(TASK_TITLE_MAX_LENGTH)],
    ],
  });

  private readonly ids$ = toObservable(
    computed(() => [this.workspaceId(), this.projectId()] as const),
  );

  ngOnInit(): void {
    this.ids$
      .pipe(
        switchMap(([workspaceId, projectId]) =>
          forkJoin({
            tasks: this.api.list(workspaceId, projectId),
            members: this.workspacesApi.listMembers(workspaceId),
          }).pipe(
            map((loaded) => ({ loaded })),
            catchError((error: unknown) => of({ error })),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(false);
        if ('error' in result) {
          this.loadError.set(httpErrorMessage(result.error));
          return;
        }
        this.tasks.set(result.loaded.tasks);
        this.members.set(result.loaded.members);
        this.loadError.set(null);
      });

    // Live updates from other people working on the same board.
    this.ids$
      .pipe(
        switchMap(([workspaceId, projectId]) =>
          this.realtime.boardEvents(workspaceId, projectId),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => this.applyLiveEvent(event));
  }

  private applyLiveEvent(event: BoardStreamEvent): void {
    switch (event.type) {
      case 'task.upserted':
        this.upsert(event.task);
        break;
      case 'task.moved':
        // Our own moves are already applied optimistically. Someone else's move
        // also renumbered other cards, so reload instead of guessing positions.
        if (event.actorId !== this.currentUserId()) this.reload();
        break;
      case 'task.deleted':
        this.tasks.update((list) => list.filter((t) => t.id !== event.taskId));
        if (this.selectedId() === event.taskId) this.closePanel();
        break;
      case 'comment.upserted':
        this.comments()?.upsert(event.comment);
        break;
      case 'comment.deleted':
        this.comments()?.removeLocal(event.commentId);
        break;
      case 'resync':
        this.reload(); // reconnected: we may have missed events
        break;
      case 'activity.recorded':
        break; // the activity feed listens for these itself
    }
  }

  private reload(): void {
    this.api.list(this.workspaceId(), this.projectId()).subscribe({
      next: (tasks) => this.tasks.set(tasks),
      error: () => undefined, // keep the current board; the next event retries
    });
  }

  /** cdkDropList data is the column's status; item data is the task. */
  protected onDrop(event: CdkDragDrop<TaskStatus, TaskStatus, TaskDto>): void {
    const sameSpot =
      event.previousContainer.data === event.container.data &&
      event.previousIndex === event.currentIndex;
    if (!sameSpot) {
      this.move(event.item.data.id, event.container.data, event.currentIndex);
    }
  }

  /** From the panel's status select: append to the bottom of the new column. */
  protected changeStatus(status: TaskStatus): void {
    const task = this.selected();
    if (task) {
      this.move(task.id, status, this.columns()[status].length);
    }
  }

  protected addTask(): void {
    if (this.quickAdd.invalid) {
      return;
    }
    this.adding.set(true);
    this.boardError.set(null);
    this.api
      .create(this.workspaceId(), this.projectId(), {
        title: this.quickAdd.getRawValue().title,
      })
      .subscribe({
        next: (task) => {
          // upsert, not append: the live event for this task may have arrived first.
          this.upsert(task);
          this.quickAdd.reset();
          this.adding.set(false);
        },
        error: (error: unknown) => {
          this.boardError.set(httpErrorMessage(error, TASK_ERRORS));
          this.adding.set(false);
        },
      });
  }

  protected saveSelected(changes: UpdateTaskRequest): void {
    const task = this.selected();
    if (!task) {
      return;
    }
    this.runPanelAction(
      this.api.update(this.workspaceId(), this.projectId(), task.id, changes),
      (updated) => this.upsert(updated),
    );
  }

  protected deleteSelected(): void {
    const task = this.selected();
    if (!task) {
      return;
    }
    this.runPanelAction(
      this.api.delete(this.workspaceId(), this.projectId(), task.id),
      () => {
        this.selectedId.set(null);
        this.tasks.update((list) => list.filter((t) => t.id !== task.id));
      },
    );
  }

  protected closePanel(): void {
    this.selectedId.set(null);
    this.panelError.set(null);
  }

  private move(taskId: string, status: TaskStatus, index: number): void {
    const previous = this.tasks();
    this.tasks.set(moveTask(previous, taskId, status, index));
    this.boardError.set(null);

    this.api
      .move(this.workspaceId(), this.projectId(), taskId, { status, index })
      .subscribe({
        next: (moved) => this.upsert(moved),
        error: (error: unknown) => {
          this.tasks.set(previous); // roll back the optimistic move
          this.boardError.set(httpErrorMessage(error, TASK_ERRORS));
        },
      });
  }

  /** Insert or replace by id: safe whichever of HTTP response / live event comes first. */
  private upsert(task: TaskDto): void {
    this.tasks.update((list) =>
      list.some((t) => t.id === task.id)
        ? list.map((t) => (t.id === task.id ? task : t))
        : [...list, task],
    );
  }

  private runPanelAction<T>(
    request: Observable<T>,
    onSuccess: (value: T) => void,
  ): void {
    this.panelBusy.set(true);
    this.panelError.set(null);
    request.subscribe({
      next: (value) => {
        onSuccess(value);
        this.panelBusy.set(false);
      },
      error: (error: unknown) => {
        this.panelError.set(httpErrorMessage(error, TASK_ERRORS));
        this.panelBusy.set(false);
      },
    });
  }
}
