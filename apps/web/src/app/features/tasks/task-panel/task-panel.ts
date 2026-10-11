import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  MemberDto,
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_PRIORITIES,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  TASK_TITLE_MAX_LENGTH,
  TaskDto,
  TaskPriority,
  TaskStatus,
  UpdateTaskRequest,
} from '@teamflow/shared';
import { ButtonComponent, FormFieldComponent } from '@teamflow/ui';

/**
 * Dumb: shows and edits one task, emits intents. The board (smart parent) talks to
 * the API. The status select is the keyboard/screen-reader alternative to dragging.
 */
@Component({
  selector: 'tf-task-panel',
  imports: [ReactiveFormsModule, ButtonComponent, FormFieldComponent],
  templateUrl: './task-panel.html',
  styleUrl: './task-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
})
export class TaskPanel {
  readonly task = input.required<TaskDto>();
  readonly members = input.required<MemberDto[]>();
  readonly canEdit = input(false);
  readonly canDelete = input(false);
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly save = output<UpdateTaskRequest>();
  readonly statusChange = output<TaskStatus>();
  readonly remove = output<void>();
  readonly closed = output<void>();

  protected readonly statuses = TASK_STATUSES;
  protected readonly statusLabels = TASK_STATUS_LABELS;
  protected readonly priorities = TASK_PRIORITIES;

  private readonly titleInput =
    viewChild<ElementRef<HTMLInputElement>>('titleInput');

  protected readonly form = inject(NonNullableFormBuilder).group({
    title: [
      '',
      [Validators.required, Validators.maxLength(TASK_TITLE_MAX_LENGTH)],
    ],
    description: ['', [Validators.maxLength(TASK_DESCRIPTION_MAX_LENGTH)]],
    priority: ['MEDIUM' as TaskPriority],
    /** '' = unassigned (a <select> cannot hold null). */
    assigneeId: [''],
  });

  /**
   * Changes only for a different task or a newer server version. Optimistic board
   * updates (new object, same updatedAt) must not wipe what the user is typing.
   */
  private readonly taskVersion = computed(
    () => `${this.task().id}@${this.task().updatedAt}`,
  );

  constructor() {
    effect(() => {
      this.taskVersion();
      const task = untracked(this.task);
      this.form.reset({
        title: task.title,
        description: task.description ?? '',
        priority: task.priority,
        assigneeId: task.assignee?.userId ?? '',
      });
      if (this.canEdit()) {
        this.form.enable({ emitEvent: false });
      } else {
        this.form.disable({ emitEvent: false });
      }
    });

    // Move focus into the dialog when it opens, for keyboard users.
    effect(() => this.titleInput()?.nativeElement.focus());
  }

  protected titleError(): string | null {
    const control = this.form.controls.title;
    if (!control.touched || control.valid) {
      return null;
    }
    return control.hasError('required')
      ? 'A title is required'
      : `Use at most ${TASK_TITLE_MAX_LENGTH} characters`;
  }

  protected onStatusSelected(event: Event): void {
    const status = (event.target as HTMLSelectElement).value as TaskStatus;
    if (status !== this.task().status) {
      this.statusChange.emit(status);
    }
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { title, description, priority, assigneeId } =
      this.form.getRawValue();
    this.save.emit({
      title,
      description: description.trim() || null,
      priority,
      assigneeId: assigneeId || null,
    });
  }

  protected confirmRemove(): void {
    if (confirm(`Delete ${this.task().key}? This cannot be undone.`)) {
      this.remove.emit();
    }
  }
}
