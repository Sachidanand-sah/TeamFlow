import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { authInterceptor } from '../auth/auth.interceptor';
import { AuthService } from '../auth/auth.service';
import { AttachmentsApi, UploadProgress } from './attachments.api';

const ref = { workspaceId: 'ws-1', projectId: 'p-1', taskId: 't-1' };
const BASE = '/api/workspaces/ws-1/projects/p-1/tasks/t-1/attachments';

describe('AttachmentsApi', () => {
  let api: AttachmentsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        // With the real interceptor, to prove the token never goes to storage.
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { getAccessToken: () => 'access-1', refresh: jest.fn() },
        },
        { provide: Router, useValue: { navigateByUrl: jest.fn() } },
      ],
    });
    api = TestBed.inject(AttachmentsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('announces a file with its name, type and size', () => {
    api
      .create(ref, { name: 'a.pdf', type: 'application/pdf', size: 10 })
      .subscribe();

    const req = http.expectOne({ method: 'POST', url: BASE });
    expect(req.request.body).toEqual({
      fileName: 'a.pdf',
      contentType: 'application/pdf',
      size: 10,
    });
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-1');
    req.flush({});
  });

  it('PUTs the raw file to storage with the signed headers and no token', () => {
    const events: UploadProgress[] = [];
    const file = new Blob(['hello'], { type: 'text/plain' });
    api
      .uploadToStorage(
        {
          url: 'http://localhost:9000/bucket/k?X-Amz-Signature=s',
          method: 'PUT',
          headers: {
            'Content-Type': 'text/plain',
            'Content-Disposition': 'attachment; filename="a.txt"',
          },
        },
        file,
      )
      .subscribe((e) => events.push(e));

    const req = http.expectOne(
      'http://localhost:9000/bucket/k?X-Amz-Signature=s',
    );
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toBe(file);
    expect(req.request.headers.get('Content-Type')).toBe('text/plain');
    expect(req.request.headers.get('Content-Disposition')).toBe(
      'attachment; filename="a.txt"',
    );
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.event({ type: 1, loaded: 50, total: 100 }); // UploadProgress
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(events).toEqual([{ percent: 50 }, { done: true }]);
  });

  it('completes, downloads and deletes', () => {
    api.complete(ref, 'a-1').subscribe();
    http.expectOne({ method: 'POST', url: `${BASE}/a-1/complete` }).flush({});

    api.download(ref, 'a-1').subscribe();
    http
      .expectOne({ method: 'GET', url: `${BASE}/a-1/download` })
      .flush({ url: 'x' });

    api.delete(ref, 'a-1').subscribe();
    http.expectOne({ method: 'DELETE', url: `${BASE}/a-1` }).flush(null);
  });
});
