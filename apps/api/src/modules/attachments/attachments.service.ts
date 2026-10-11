import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  AttachmentDownload,
  AttachmentDto,
  canDeleteAttachment,
  CreateAttachmentRequest,
  CreateAttachmentResponse,
  sanitizeFileName,
} from '@teamflow/shared';
import { randomUUID } from 'node:crypto';
import { filter, Subscription } from 'rxjs';
import { DomainEvents } from '../../events/domain-events';
import { orNotFound } from '../../prisma/prisma-errors';
import { StorageService } from '../../storage/storage.service';
import { TasksService } from '../tasks/tasks.service';
import { WorkspaceMember } from '../workspaces/workspace-member';
import {
  AttachmentsRepository,
  AttachmentWithUploader,
} from './attachments.repository';

const ATTACHMENT_NOT_FOUND = 'Attachment not found';

export function toAttachmentDto(row: AttachmentWithUploader): AttachmentDto {
  return {
    id: row.id,
    taskId: row.taskId,
    fileName: row.fileName,
    contentType: row.contentType,
    size: row.size,
    uploader: row.uploader
      ? { userId: row.uploader.id, name: row.uploader.name }
      : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Storage keys are built by the server only: tenant + task + random id. */
export function taskPrefix(workspaceId: string, taskId: string): string {
  return `workspaces/${workspaceId}/tasks/${taskId}/`;
}

/**
 * Upload flow (see ADR 0005):
 * 1. `create`  -> PENDING row + signed upload policy (exact size and type).
 * 2. Browser uploads straight to storage.
 * 3. `complete` -> server checks the object really exists with that size and type,
 *    then marks it READY. Only READY files are listed or downloadable.
 */
@Injectable()
export class AttachmentsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AttachmentsService.name);
  private subscription?: Subscription;

  constructor(
    private readonly attachments: AttachmentsRepository,
    private readonly tasks: TasksService,
    private readonly storage: StorageService,
    private readonly events: DomainEvents,
  ) {}

  /** When a task is deleted, its rows cascade in Postgres; remove its files too. */
  onModuleInit(): void {
    this.subscription = this.events.events$
      .pipe(filter(({ event }) => event.type === 'task.deleted'))
      .subscribe(({ workspaceId, event }) => {
        if (event.type !== 'task.deleted') return;
        this.storage
          .deletePrefix(taskPrefix(workspaceId, event.taskId))
          .catch((error: unknown) =>
            this.logger.warn(
              `Could not delete files of task ${event.taskId}: ${String(error)}`,
            ),
          );
      });
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  async list(
    member: WorkspaceMember,
    projectId: string,
    taskId: string,
  ): Promise<AttachmentDto[]> {
    await this.tasks.get(member, projectId, taskId);
    const rows = await this.attachments.listReady(member.workspaceId, taskId);
    return rows.map(toAttachmentDto);
  }

  async create(
    member: WorkspaceMember,
    projectId: string,
    taskId: string,
    request: CreateAttachmentRequest,
  ): Promise<CreateAttachmentResponse> {
    await this.tasks.get(member, projectId, taskId);
    const storageKey = `${taskPrefix(member.workspaceId, taskId)}${randomUUID()}`;
    const row = await this.attachments.create(member.workspaceId, taskId, {
      uploaderId: member.userId,
      fileName: sanitizeFileName(request.fileName),
      contentType: request.contentType,
      size: request.size,
      storageKey,
    });
    const upload = await this.storage.createUpload(
      storageKey,
      request.contentType,
      request.size,
    );
    return { attachment: toAttachmentDto(row), upload };
  }

  async complete(
    member: WorkspaceMember,
    projectId: string,
    taskId: string,
    attachmentId: string,
  ): Promise<AttachmentDto> {
    const row = await this.findOrFail(member, projectId, taskId, attachmentId);
    if (row.uploaderId !== member.userId) {
      throw new ForbiddenException('Only the uploader can complete an upload');
    }
    if (row.status === 'READY') {
      return toAttachmentDto(row); // idempotent: safe to retry
    }

    const stored = await this.storage.head(row.storageKey);
    const matches =
      stored !== null &&
      stored.size === row.size &&
      stored.contentType === row.contentType;
    if (!matches) {
      // Never keep something we did not authorise.
      if (stored) await this.storage.delete(row.storageKey);
      await this.attachments.delete(member.workspaceId, taskId, row.id);
      throw new BadRequestException(
        'The uploaded file is missing or does not match what was announced',
      );
    }

    return toAttachmentDto(await this.attachments.markReady(row.id));
  }

  async download(
    member: WorkspaceMember,
    projectId: string,
    taskId: string,
    attachmentId: string,
  ): Promise<AttachmentDownload> {
    const row = await this.findOrFail(member, projectId, taskId, attachmentId);
    if (row.status !== 'READY') {
      throw new NotFoundException(ATTACHMENT_NOT_FOUND);
    }
    return {
      url: await this.storage.downloadUrl(row.storageKey, row.fileName),
    };
  }

  async delete(
    member: WorkspaceMember,
    projectId: string,
    taskId: string,
    attachmentId: string,
  ): Promise<void> {
    const row = await this.findOrFail(member, projectId, taskId, attachmentId);
    if (!canDeleteAttachment(member.role, row.uploaderId === member.userId)) {
      throw new ForbiddenException(
        'Only the uploader or an admin can delete this file',
      );
    }
    await orNotFound(
      this.attachments.delete(member.workspaceId, taskId, row.id),
      ATTACHMENT_NOT_FOUND,
    );
    // Row first, then bytes: if storage fails, the file is merely orphaned (and
    // unreachable), never listed-but-missing.
    await this.storage
      .delete(row.storageKey)
      .catch((error: unknown) =>
        this.logger.warn(`Orphaned object ${row.storageKey}: ${String(error)}`),
      );
  }

  private async findOrFail(
    member: WorkspaceMember,
    projectId: string,
    taskId: string,
    attachmentId: string,
  ): Promise<AttachmentWithUploader> {
    await this.tasks.get(member, projectId, taskId);
    const row = await this.attachments.find(
      member.workspaceId,
      taskId,
      attachmentId,
    );
    if (!row) {
      throw new NotFoundException(ATTACHMENT_NOT_FOUND);
    }
    return row;
  }
}
