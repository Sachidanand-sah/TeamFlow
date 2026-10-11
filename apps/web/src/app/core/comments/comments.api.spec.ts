import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivityApi } from '../activity/activity.api';
import { CommentsApi } from './comments.api';

const ref = { workspaceId: 'ws-1', projectId: 'p-1', taskId: 't-1' };
const BASE = '/api/workspaces/ws-1/projects/p-1/tasks/t-1/comments';

describe('CommentsApi and ActivityApi', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('calls the comment endpoints', () => {
    const api = TestBed.inject(CommentsApi);

    api.list(ref).subscribe();
    http.expectOne({ method: 'GET', url: BASE }).flush([]);

    api.create(ref, 'Hi').subscribe();
    const create = http.expectOne({ method: 'POST', url: BASE });
    expect(create.request.body).toEqual({ body: 'Hi' });
    create.flush({});

    api.update(ref, 'c-1', 'Edited').subscribe();
    http.expectOne({ method: 'PATCH', url: `${BASE}/c-1` }).flush({});

    api.delete(ref, 'c-1').subscribe();
    http.expectOne({ method: 'DELETE', url: `${BASE}/c-1` }).flush(null);
  });

  it('pages through activity with a cursor', () => {
    const api = TestBed.inject(ActivityApi);

    api.list('ws-1', 'p-1').subscribe();
    http
      .expectOne('/api/workspaces/ws-1/projects/p-1/activity')
      .flush({ items: [], nextCursor: null });

    api.list('ws-1', 'p-1', { cursor: 'a-9', taskId: 't-1' }).subscribe();
    http
      .expectOne(
        '/api/workspaces/ws-1/projects/p-1/activity?taskId=t-1&cursor=a-9',
      )
      .flush({ items: [], nextCursor: null });
  });
});
