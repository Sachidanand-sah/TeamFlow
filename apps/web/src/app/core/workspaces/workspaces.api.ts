import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  AddMemberRequest,
  AssignableWorkspaceRole,
  MemberDto,
  WorkspaceDto,
} from '@teamflow/shared';
import { Observable } from 'rxjs';

/** Thin HTTP wrapper: no state, no business rules. Pages own their state. */
@Injectable({ providedIn: 'root' })
export class WorkspacesApi {
  private readonly http = inject(HttpClient);

  list(): Observable<WorkspaceDto[]> {
    return this.http.get<WorkspaceDto[]>('/api/workspaces');
  }

  create(name: string): Observable<WorkspaceDto> {
    return this.http.post<WorkspaceDto>('/api/workspaces', { name });
  }

  get(workspaceId: string): Observable<WorkspaceDto> {
    return this.http.get<WorkspaceDto>(this.url(workspaceId));
  }

  rename(workspaceId: string, name: string): Observable<WorkspaceDto> {
    return this.http.patch<WorkspaceDto>(this.url(workspaceId), { name });
  }

  delete(workspaceId: string): Observable<void> {
    return this.http.delete<void>(this.url(workspaceId));
  }

  listMembers(workspaceId: string): Observable<MemberDto[]> {
    return this.http.get<MemberDto[]>(`${this.url(workspaceId)}/members`);
  }

  addMember(
    workspaceId: string,
    request: AddMemberRequest,
  ): Observable<MemberDto> {
    return this.http.post<MemberDto>(
      `${this.url(workspaceId)}/members`,
      request,
    );
  }

  changeRole(
    workspaceId: string,
    userId: string,
    role: AssignableWorkspaceRole,
  ): Observable<MemberDto> {
    return this.http.patch<MemberDto>(
      `${this.url(workspaceId)}/members/${encodeURIComponent(userId)}`,
      { role },
    );
  }

  removeMember(workspaceId: string, userId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.url(workspaceId)}/members/${encodeURIComponent(userId)}`,
    );
  }

  /** Ids come from the URL bar; encode them so they cannot alter the request path. */
  private url(workspaceId: string): string {
    return `/api/workspaces/${encodeURIComponent(workspaceId)}`;
  }
}
