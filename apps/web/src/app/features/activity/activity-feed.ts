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
import { AvatarComponent, IconComponent } from '@teamflow/ui';
import {
  catchError,
  combineLatest,
  map,
  of,
  startWith,
  Subject,
  switchMap,
} from 'rxjs';
import { ActivityApi } from '../../core/activity/activity.api';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { httpErrorMessage } from '../../core/http-error-message';
import { relativeTime } from '../../core/relative-time';

/** Smart: a project's history, newest first, with "Show older". */
@Component({
  selector: 'tf-activity-feed',
  imports: [AvatarComponent, IconComponent],
  template: `
    <h2 class="title">
      <tf-icon name="activity" />
      Activity
    </h2>
    @if (loading()) {
      <div class="tf-skeleton" style="height: 6rem"></div>
    } @else if (error(); as message) {
      <p class="tf-alert tf-alert--danger" role="alert">{{ message }}</p>
    } @else if (items().length === 0) {
      <p class="muted">Nothing has happened here yet.</p>
    } @else {
      <ol class="feed">
        @for (item of items(); track item.id) {
          <li class="entry">
            <tf-avatar [name]="item.actor?.name ?? 'Someone'" [size]="28" />
            <div class="entry__text">
              <span>
                <strong>{{ item.actor?.name ?? 'Someone' }}</strong>
                {{ describe(item) }}
              </span>
              <time class="muted" [attr.datetime]="item.createdAt">
                {{ relativeTime(item.createdAt) }}
              </time>
            </div>
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
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0 0 1.25rem;
      font-size: 1rem;
    }
    .muted {
      color: var(--tf-color-text-muted);
    }
    .feed {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 1.125rem;
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: 0.875rem;
      overflow-wrap: anywhere;
    }
    /* Timeline rail behind the avatars. */
    .feed::before {
      content: '';
      position: absolute;
      top: 0.5rem;
      bottom: 0.5rem;
      left: 13px;
      width: 2px;
      background: var(--tf-color-border);
    }
    .entry {
      position: relative;
      display: flex;
      gap: 0.75rem;
    }
    .entry__text {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      padding-top: 0.25rem;
    }
    time {
      font-size: 0.75rem;
    }
    .more {
      margin-top: 1.25rem;
      padding: 0.375rem 0.75rem;
      border: 1px solid var(--tf-color-border-strong);
      border-radius: var(--tf-radius);
      background: var(--tf-color-surface);
      color: var(--tf-color-text);
      font: inherit;
      font-size: 0.8125rem;
      font-weight: 500;
      cursor: pointer;
    }
    .more:hover {
      background: var(--tf-color-surface-hover);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityFeed implements OnInit {
  readonly workspaceId = input.required<string>();
  readonly projectId = input.required<string>();

  private readonly api = inject(ActivityApi);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload$ = new Subject<void>();

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
    // Live: new entries go on top; after a reconnect, reload the first page.
    this.ids$
      .pipe(
        switchMap(([workspaceId, projectId]) =>
          this.realtime.boardEvents(workspaceId, projectId),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        if (event.type === 'activity.recorded') this.prepend(event.activity);
        if (event.type === 'resync') this.reload$.next();
      });

    combineLatest([this.ids$, this.reload$.pipe(startWith(undefined))])
      .pipe(
        map(([ids]) => ids),
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
