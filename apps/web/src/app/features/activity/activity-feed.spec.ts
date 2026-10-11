import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivityDto } from '@teamflow/shared';
import { of, Subject } from 'rxjs';
import { ActivityApi } from '../../core/activity/activity.api';
import {
  BoardStreamEvent,
  RealtimeService,
} from '../../core/realtime/realtime.service';
import { ActivityFeed } from './activity-feed';

const entry = (id: string): ActivityDto => ({
  id,
  projectId: 'p-1',
  taskId: 't-1',
  taskKey: 'WEB-3',
  actor: { userId: 'u-1', name: 'Ann' },
  createdAt: new Date().toISOString(),
  type: 'TASK_MOVED',
  data: { from: 'TODO', to: 'DONE' },
});

describe('ActivityFeed', () => {
  let fixture: ComponentFixture<ActivityFeed>;
  let api: { list: jest.Mock };

  async function render() {
    fixture = TestBed.createComponent(ActivityFeed);
    fixture.componentRef.setInput('workspaceId', 'ws-1');
    fixture.componentRef.setInput('projectId', 'p-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  let live: Subject<BoardStreamEvent>;

  beforeEach(() => {
    api = { list: jest.fn() };
    live = new Subject<BoardStreamEvent>();
    TestBed.configureTestingModule({
      imports: [ActivityFeed],
      providers: [
        { provide: ActivityApi, useValue: api },
        { provide: RealtimeService, useValue: { boardEvents: () => live } },
      ],
    });
  });

  it('shows activity recorded by others live, newest first', async () => {
    api.list.mockReturnValue(of({ items: [entry('a-1')], nextCursor: null }));
    const el = await render();

    live.next({
      type: 'activity.recorded',
      activity: {
        ...entry('a-2'),
        type: 'TASK_CREATED',
        data: { title: 'New' },
      },
      projectId: 'p-1',
      actorId: 'u-1',
    });
    fixture.detectChanges();

    expect(el.querySelector('li')?.textContent).toContain('created WEB-3');
  });

  it('reloads after a reconnect', async () => {
    api.list.mockReturnValue(of({ items: [], nextCursor: null }));
    await render();

    live.next({ type: 'resync' });

    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it('shows entries as sentences', async () => {
    api.list.mockReturnValue(of({ items: [entry('a-1')], nextCursor: null }));

    const el = await render();

    expect(el.querySelector('li')?.textContent).toContain(
      'Ann moved WEB-3 from To do to Done',
    );
    expect(el.textContent).not.toContain('Show older');
  });

  it('loads older entries with the cursor', async () => {
    api.list
      .mockReturnValueOnce(of({ items: [entry('a-2')], nextCursor: 'a-2' }))
      .mockReturnValueOnce(of({ items: [entry('a-1')], nextCursor: null }));
    const el = await render();

    Array.from(el.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Show older'))
      ?.click();
    fixture.detectChanges();

    expect(api.list).toHaveBeenLastCalledWith('ws-1', 'p-1', { cursor: 'a-2' });
    expect(el.querySelectorAll('li')).toHaveLength(2);
    expect(el.textContent).not.toContain('Show older');
  });

  it('prepends live entries once', async () => {
    api.list.mockReturnValue(of({ items: [entry('a-1')], nextCursor: null }));
    const el = await render();

    fixture.componentInstance.prepend(entry('a-2'));
    fixture.componentInstance.prepend(entry('a-2'));
    fixture.detectChanges();

    expect(el.querySelectorAll('li')).toHaveLength(2);
  });
});
