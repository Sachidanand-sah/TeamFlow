import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TaskDto } from '@teamflow/shared';

/** Dumb: one card on the board. */
@Component({
  selector: 'tf-task-card',
  template: `
    <div class="card__top">
      <span class="card__key">{{ task().key }}</span>
      <span
        class="card__priority"
        [class]="
          'card__priority card__priority--' + task().priority.toLowerCase()
        "
      >
        {{ task().priority.toLowerCase() }}
      </span>
    </div>
    <p class="card__title">{{ task().title }}</p>
    @if (task().assignee; as assignee) {
      <span class="card__assignee" [title]="assignee.name">
        {{ initials(assignee.name) }}
      </span>
    }
  `,
  styles: `
    :host {
      display: block;
      padding: 0.625rem 0.75rem;
      border: 1px solid var(--tf-color-border);
      border-radius: 6px;
      background: var(--tf-color-surface);
      cursor: pointer;
    }
    .card__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .card__key {
      font-family: ui-monospace, monospace;
      font-size: 0.75rem;
      color: var(--tf-color-text-muted);
    }
    .card__priority {
      font-size: 0.6875rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var(--tf-color-text-muted);
    }
    .card__priority--high {
      color: #e67700;
    }
    .card__priority--urgent {
      color: var(--tf-color-danger);
      font-weight: 700;
    }
    .card__title {
      margin: 0.25rem 0 0;
      overflow-wrap: anywhere;
    }
    .card__assignee {
      display: inline-grid;
      place-items: center;
      width: 1.5rem;
      height: 1.5rem;
      margin-top: 0.5rem;
      border-radius: 50%;
      background: var(--tf-color-primary);
      color: var(--tf-color-on-primary);
      font-size: 0.6875rem;
      font-weight: 700;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskCard {
  readonly task = input.required<TaskDto>();

  protected initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }
}
