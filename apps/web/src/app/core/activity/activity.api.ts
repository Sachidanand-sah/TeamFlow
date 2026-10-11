import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ActivityPage } from '@teamflow/shared';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ActivityApi {
  private readonly http = inject(HttpClient);

  /** Newest first. Pass the previous page's `nextCursor` to load older entries. */
  list(
    workspaceId: string,
    projectId: string,
    options: { taskId?: string; cursor?: string } = {},
  ): Observable<ActivityPage> {
    let params = new HttpParams();
    if (options.taskId) params = params.set('taskId', options.taskId);
    if (options.cursor) params = params.set('cursor', options.cursor);
    const e = encodeURIComponent;
    return this.http.get<ActivityPage>(
      `/api/workspaces/${e(workspaceId)}/projects/${e(projectId)}/activity`,
      { params },
    );
  }
}
