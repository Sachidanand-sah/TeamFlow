import {
  HttpClient,
  HttpEvent,
  HttpEventType,
  HttpHeaders,
} from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import {
  AllowedAttachmentType,
  AttachmentDownload,
  AttachmentDto,
  CreateAttachmentResponse,
  PresignedUpload,
} from '@teamflow/shared';
import { filter, map, Observable } from 'rxjs';
import { TaskRef } from '../comments/comments.api';

/** Opens a URL in the current tab (a download, thanks to Content-Disposition). */
export const NAVIGATE_TO_URL = new InjectionToken<(url: string) => void>(
  'NAVIGATE_TO_URL',
  { providedIn: 'root', factory: () => (url) => window.location.assign(url) },
);

/** Upload progress 0..100, then `done`. */
export type UploadProgress = { percent: number } | { done: true };

@Injectable({ providedIn: 'root' })
export class AttachmentsApi {
  private readonly http = inject(HttpClient);

  list(ref: TaskRef): Observable<AttachmentDto[]> {
    return this.http.get<AttachmentDto[]>(this.base(ref));
  }

  /** Step 1: announce the file; the API answers with a signed upload policy. */
  create(
    ref: TaskRef,
    file: { name: string; type: AllowedAttachmentType; size: number },
  ): Observable<CreateAttachmentResponse> {
    return this.http.post<CreateAttachmentResponse>(this.base(ref), {
      fileName: file.name,
      contentType: file.type,
      size: file.size,
    });
  }

  /**
   * Step 2: PUT the raw bytes straight to object storage with exactly the signed
   * headers. The URL is not under /api, so the auth interceptor does not attach our
   * access token to it.
   */
  uploadToStorage(
    upload: PresignedUpload,
    file: Blob,
  ): Observable<UploadProgress> {
    return this.http
      .request(upload.method, upload.url, {
        body: file,
        headers: new HttpHeaders(upload.headers),
        reportProgress: true,
        observe: 'events',
      })
      .pipe(
        filter(
          (e: HttpEvent<unknown>) =>
            e.type === HttpEventType.UploadProgress ||
            e.type === HttpEventType.Response,
        ),
        map((e): UploadProgress =>
          e.type === HttpEventType.UploadProgress
            ? { percent: e.total ? Math.round((100 * e.loaded) / e.total) : 0 }
            : { done: true },
        ),
      );
  }

  /** Step 3: ask the API to verify the stored object and publish the attachment. */
  complete(ref: TaskRef, attachmentId: string): Observable<AttachmentDto> {
    return this.http.post<AttachmentDto>(
      `${this.one(ref, attachmentId)}/complete`,
      null,
    );
  }

  download(ref: TaskRef, attachmentId: string): Observable<AttachmentDownload> {
    return this.http.get<AttachmentDownload>(
      `${this.one(ref, attachmentId)}/download`,
    );
  }

  delete(ref: TaskRef, attachmentId: string): Observable<void> {
    return this.http.delete<void>(this.one(ref, attachmentId));
  }

  private base({ workspaceId, projectId, taskId }: TaskRef): string {
    const e = encodeURIComponent;
    return `/api/workspaces/${e(workspaceId)}/projects/${e(projectId)}/tasks/${e(taskId)}/attachments`;
  }

  private one(ref: TaskRef, attachmentId: string): string {
    return `${this.base(ref)}/${encodeURIComponent(attachmentId)}`;
  }
}
