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
import { ActivityDto, describeActivity } from '@teamflow/shared';
import { catchError, map, of, switchMap } from 'rxjs';
import { ActivityApi } from '../../core/activity/activity.api';
import { httpErrorMessage } from '../../core/http-error-message';
import { relativeTime } from '../../core/relative-time';

/** Smart: a project's history, newest first, with "Show older". */
@Component({
  selector: 'tf-activity-feed',
  template: `
    <h2 class="title">Activity</h2>
    @if (loading()) {
      <p class="muted">Loading activity…</p>
    } @else if (error(); as message) {
      <p class="error" role="alert">{{ message }}</p>
    } @else if (items().length === 0) {
      <p class="muted">Nothing has happened here yet.</p>
    } @else {
      <ol class="feed">
        @for (item of items(); track item.id) {
          <li>
            <strong>{{ item.actor?.name ?? 'Someone' }}</strong>
            {{ describe(item) }}
            <span class="muted">· {{ relativeTime(item.createdAt) }}</span>
          </li>
        }
      </ol>
      @if (nextCursor()) {
        <button
          type="button"
          class="more"
          [disabled]="loadingMore()"
          (click)="loadMore()"
        >
          {{ loadingMore() ? 'Loading…' : 'Show older' }}
        </button>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .title {
      margin: 0 0 0.75rem;
      font-size: 1rem;
    }
    .muted {
      color: var(--tf-color-text-muted);
    }
    .error {
      color: var(--tf-color-danger);
    }
    .feed {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: 0.875rem;
      overflow-wrap: anywhere;
    }
    .more {
      margin-top: 0.75rem;
      padding: 0;
      border: 0;
      background: none;
      color: var(--tf-color-primary);
      font: inherit;
      cursor: pointer;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityFeed implements OnInit {
  readonly workspaceId = input.required<string>();
  readonly projectId = input.required<string>();

  private readonly api = inject(ActivityApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly items = signal<ActivityDto[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly describe = describeActivity;
  protected readonly relativeTime = relativeTime;

  private readonly ids$ = toObservable(
    computed(() => [this.workspaceId(), this.projectId()] as const),
  );

  ngOnInit(): void {
    this.ids$
      .pipe(
        switchMap(([workspaceId, projectId]) =>
          this.api.list(workspaceId, projectId).pipe(
            map((page) => ({ page })),
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
        this.items.set(result.page.items);
        this.nextCursor.set(result.page.nextCursor);
        this.error.set(null);
      });
  }

  /** Adds a newly recorded entry at the top (used by live updates). */
  prepend(activity: ActivityDto): void {
    if (activity.projectId !== this.projectId()) return;
    this.items.update((list) =>
      list.some((a) => a.id === activity.id) ? list : [activity, ...list],
    );
  }

  protected loadMore(): void {
    const cursor = this.nextCursor();
    if (!cursor) return;
    this.loadingMore.set(true);
    this.api.list(this.workspaceId(), this.projectId(), { cursor }).subscribe({
      next: (page) => {
        this.items.update((list) => [...list, ...page.items]);
        this.nextCursor.set(page.nextCursor);
        this.loadingMore.set(false);
      },
      error: (error: unknown) => {
        this.error.set(httpErrorMessage(error));
        this.loadingMore.set(false);
      },
    });
  }
}
