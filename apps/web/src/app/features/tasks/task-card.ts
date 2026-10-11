import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { TaskDto, TaskPriority } from '@teamflow/shared';
import { AvatarComponent, IconComponent } from '@teamflow/ui';

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

/** Dumb: one card on the board. */
@Component({
  selector: 'tf-task-card',
  imports: [AvatarComponent, IconComponent],
  template: `
    <p class="card__title">{{ task().title }}</p>
    <div class="card__meta">
      <span class="card__key">{{ task().key }}</span>
      <span [class]="'card__priority card__priority--' + priorityClass()">
        <tf-icon name="flag" [size]="12" />
        {{ priorityLabel() }}
      </span>
      <span class="card__spacer"></span>
      @if (task().assignee; as assignee) {
        <tf-avatar class="card__assignee" [name]="assignee.name" [size]="24" />
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      padding: 0.75rem 0.875rem;
      border: 1px solid var(--tf-color-border);
      border-radius: var(--tf-radius);
      background: var(--tf-color-surface);
      box-shadow: var(--tf-shadow-xs);
      cursor: pointer;
      transition:
        border-color 120ms ease,
        box-shadow 120ms ease;
    }
    :host(:hover) {
      border-color: var(--tf-color-border-strong);
      box-shadow: var(--tf-shadow-md);
    }
    .card__title {
      margin: 0 0 0.625rem;
      font-weight: 500;
      line-height: 1.4;
      overflow-wrap: anywhere;
    }
    .card__meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .card__spacer {
      flex: 1;
    }
    .card__key {
      color: var(--tf-color-text-subtle);
      font-family: var(--tf-font-mono);
      font-size: 0.6875rem;
      font-weight: 500;
    }
    .card__priority {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.0625rem 0.4375rem;
      border-radius: 999px;
      font-size: 0.6875rem;
      font-weight: 600;
    }
    .card__priority--low {
      background: var(--tf-color-surface-2);
      color: var(--tf-color-text-muted);
    }
    .card__priority--medium {
      background: var(--tf-color-info-surface);
      color: var(--tf-color-info);
    }
    .card__priority--high {
      background: var(--tf-color-warning-surface);
      color: var(--tf-color-warning);
    }
    .card__priority--urgent {
      background: var(--tf-color-danger-surface);
      color: var(--tf-color-danger);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskCard {
  readonly task = input.required<TaskDto>();

  protected readonly priorityClass = computed(() =>
    this.task().priority.toLowerCase(),
  );
  protected readonly priorityLabel = computed(
    () => PRIORITY_LABELS[this.task().priority],
  );
}
