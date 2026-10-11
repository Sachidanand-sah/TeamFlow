import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  CreateTaskRequest,
  MoveTaskRequest,
  TaskDto,
  UpdateTaskRequest,
} from '@teamflow/shared';
import { Observable } from 'rxjs';

/** Thin HTTP wrapper for /workspaces/:w/projects/:p/tasks. */
@Injectable({ providedIn: 'root' })
export class TasksApi {
  private readonly http = inject(HttpClient);

  list(workspaceId: string, projectId: string): Observable<TaskDto[]> {
    return this.http.get<TaskDto[]>(this.base(workspaceId, projectId));
  }

  create(
    workspaceId: string,
    projectId: string,
    request: CreateTaskRequest,
  ): Observable<TaskDto> {
    return this.http.post<TaskDto>(this.base(workspaceId, projectId), request);
  }

  update(
    workspaceId: string,
    projectId: string,
    taskId: string,
    request: UpdateTaskRequest,
  ): Observable<TaskDto> {
    return this.http.patch<TaskDto>(
      this.one(workspaceId, projectId, taskId),
      request,
    );
  }

  move(
    workspaceId: string,
    projectId: string,
    taskId: string,
    request: MoveTaskRequest,
  ): Observable<TaskDto> {
    return this.http.post<TaskDto>(
      `${this.one(workspaceId, projectId, taskId)}/move`,
      request,
    );
  }

  delete(
    workspaceId: string,
    projectId: string,
    taskId: string,
  ): Observable<void> {
    return this.http.delete<void>(this.one(workspaceId, projectId, taskId));
  }

  private base(workspaceId: string, projectId: string): string {
    return `/api/workspaces/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}/tasks`;
  }

  private one(workspaceId: string, projectId: string, taskId: string): string {
    return `${this.base(workspaceId, projectId)}/${encodeURIComponent(taskId)}`;
  }
}
