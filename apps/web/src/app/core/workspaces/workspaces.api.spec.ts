import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WorkspacesApi } from './workspaces.api';

describe('WorkspacesApi', () => {
  let api: WorkspacesApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(WorkspacesApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists and creates workspaces', () => {
    api.list().subscribe();
    http.expectOne({ method: 'GET', url: '/api/workspaces' }).flush([]);

    api.create('Acme').subscribe();
    const req = http.expectOne({ method: 'POST', url: '/api/workspaces' });
    expect(req.request.body).toEqual({ name: 'Acme' });
    req.flush({});
  });

  it('targets a single workspace', () => {
    api.get('ws-1').subscribe();
    http.expectOne({ method: 'GET', url: '/api/workspaces/ws-1' }).flush({});

    api.rename('ws-1', 'New').subscribe();
    const rename = http.expectOne({
      method: 'PATCH',
      url: '/api/workspaces/ws-1',
    });
    expect(rename.request.body).toEqual({ name: 'New' });
    rename.flush({});

    api.delete('ws-1').subscribe();
    http
      .expectOne({ method: 'DELETE', url: '/api/workspaces/ws-1' })
      .flush(null);
  });

  it('manages members', () => {
    api.listMembers('ws-1').subscribe();
    http
      .expectOne({ method: 'GET', url: '/api/workspaces/ws-1/members' })
      .flush([]);

    api
      .addMember('ws-1', { email: 'bob@example.com', role: 'MEMBER' })
      .subscribe();
    const add = http.expectOne({
      method: 'POST',
      url: '/api/workspaces/ws-1/members',
    });
    expect(add.request.body).toEqual({
      email: 'bob@example.com',
      role: 'MEMBER',
    });
    add.flush({});

    api.changeRole('ws-1', 'u-2', 'VIEWER').subscribe();
    const change = http.expectOne({
      method: 'PATCH',
      url: '/api/workspaces/ws-1/members/u-2',
    });
    expect(change.request.body).toEqual({ role: 'VIEWER' });
    change.flush({});

    api.removeMember('ws-1', 'u-2').subscribe();
    http
      .expectOne({ method: 'DELETE', url: '/api/workspaces/ws-1/members/u-2' })
      .flush(null);
  });

  it('encodes ids so a crafted id cannot change the request path', () => {
    api.get('../users/me').subscribe();

    http.expectOne('/api/workspaces/..%2Fusers%2Fme').flush({});
  });
});
