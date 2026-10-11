import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TasksApi } from './tasks.api';

const BASE = '/api/workspaces/ws-1/projects/p-1/tasks';

describe('TasksApi', () => {
  let api: TasksApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(TasksApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists and creates tasks', () => {
    api.list('ws-1', 'p-1').subscribe();
    http.expectOne({ method: 'GET', url: BASE }).flush([]);

    api.create('ws-1', 'p-1', { title: 'Fix login' }).subscribe();
    const create = http.expectOne({ method: 'POST', url: BASE });
    expect(create.request.body).toEqual({ title: 'Fix login' });
    create.flush({});
  });

  it('updates, moves and deletes a task', () => {
    api.update('ws-1', 'p-1', 't-1', { assigneeId: null }).subscribe();
    const update = http.expectOne({ method: 'PATCH', url: `${BASE}/t-1` });
    expect(update.request.body).toEqual({ assigneeId: null });
    update.flush({});

    api.move('ws-1', 'p-1', 't-1', { status: 'DONE', index: 0 }).subscribe();
    const move = http.expectOne({ method: 'POST', url: `${BASE}/t-1/move` });
    expect(move.request.body).toEqual({ status: 'DONE', index: 0 });
    move.flush({});

    api.delete('ws-1', 'p-1', 't-1').subscribe();
    http.expectOne({ method: 'DELETE', url: `${BASE}/t-1` }).flush(null);
  });
});
