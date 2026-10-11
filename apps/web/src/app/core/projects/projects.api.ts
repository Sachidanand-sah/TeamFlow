import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  CreateProjectRequest,
  ProjectDto,
  UpdateProjectRequest,
} from '@teamflow/shared';
import { Observable } from 'rxjs';

/** Thin HTTP wrapper for /workspaces/:workspaceId/projects. */
@Injectable({ providedIn: 'root' })
export class ProjectsApi {
  private readonly http = inject(HttpClient);

  list(workspaceId: string): Observable<ProjectDto[]> {
    return this.http.get<ProjectDto[]>(this.base(workspaceId));
  }

  get(workspaceId: string, projectId: string): Observable<ProjectDto> {
    return this.http.get<ProjectDto>(this.one(workspaceId, projectId));
  }

  create(
    workspaceId: string,
    request: CreateProjectRequest,
  ): Observable<ProjectDto> {
    return this.http.post<ProjectDto>(this.base(workspaceId), request);
  }

  update(
    workspaceId: string,
    projectId: string,
    request: UpdateProjectRequest,
  ): Observable<ProjectDto> {
    return this.http.patch<ProjectDto>(
      this.one(workspaceId, projectId),
      request,
    );
  }

  delete(workspaceId: string, projectId: string): Observable<void> {
    return this.http.delete<void>(this.one(workspaceId, projectId));
  }

  private base(workspaceId: string): string {
    return `/api/workspaces/${encodeURIComponent(workspaceId)}/projects`;
  }

  private one(workspaceId: string, projectId: string): string {
    return `${this.base(workspaceId)}/${encodeURIComponent(projectId)}`;
  }
}
