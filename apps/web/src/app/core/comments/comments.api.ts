import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { CommentDto } from '@teamflow/shared';
import { Observable } from 'rxjs';

/** Identifies one task; all comment endpoints live under it. */
export interface TaskRef {
  workspaceId: string;
  projectId: string;
  taskId: string;
}

@Injectable({ providedIn: 'root' })
export class CommentsApi {
  private readonly http = inject(HttpClient);

  list(ref: TaskRef): Observable<CommentDto[]> {
    return this.http.get<CommentDto[]>(this.base(ref));
  }

  create(ref: TaskRef, body: string): Observable<CommentDto> {
    return this.http.post<CommentDto>(this.base(ref), { body });
  }

  update(
    ref: TaskRef,
    commentId: string,
    body: string,
  ): Observable<CommentDto> {
    return this.http.patch<CommentDto>(this.one(ref, commentId), { body });
  }

  delete(ref: TaskRef, commentId: string): Observable<void> {
    return this.http.delete<void>(this.one(ref, commentId));
  }

  private base({ workspaceId, projectId, taskId }: TaskRef): string {
    const e = encodeURIComponent;
    return `/api/workspaces/${e(workspaceId)}/projects/${e(projectId)}/tasks/${e(taskId)}/comments`;
  }

  private one(ref: TaskRef, commentId: string): string {
    return `${this.base(ref)}/${encodeURIComponent(commentId)}`;
  }
}
