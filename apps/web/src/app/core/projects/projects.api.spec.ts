import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ProjectsApi } from './projects.api';

describe('ProjectsApi', () => {
  let api: ProjectsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ProjectsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists and creates projects in a workspace', () => {
    api.list('ws-1').subscribe();
    http
      .expectOne({ method: 'GET', url: '/api/workspaces/ws-1/projects' })
      .flush([]);

    api.create('ws-1', { name: 'Website', key: 'WEB' }).subscribe();
    const create = http.expectOne({
      method: 'POST',
      url: '/api/workspaces/ws-1/projects',
    });
    expect(create.request.body).toEqual({ name: 'Website', key: 'WEB' });
    create.flush({});
  });

  it('reads, updates and deletes one project', () => {
    const url = '/api/workspaces/ws-1/projects/p-1';

    api.get('ws-1', 'p-1').subscribe();
    http.expectOne({ method: 'GET', url }).flush({});

    api.update('ws-1', 'p-1', { description: null }).subscribe();
    const update = http.expectOne({ method: 'PATCH', url });
    expect(update.request.body).toEqual({ description: null });
    update.flush({});

    api.delete('ws-1', 'p-1').subscribe();
    http.expectOne({ method: 'DELETE', url }).flush(null);
  });

  it('encodes ids', () => {
    api.get('ws/1', '../x').subscribe();

    http.expectOne('/api/workspaces/ws%2F1/projects/..%2Fx').flush({});
  });
});
