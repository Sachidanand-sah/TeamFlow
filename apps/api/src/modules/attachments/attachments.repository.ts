import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const attachmentInclude = {
  uploader: { select: { id: true, name: true } },
} satisfies Prisma.AttachmentInclude;

export type AttachmentWithUploader = Prisma.AttachmentGetPayload<{
  include: typeof attachmentInclude;
}>;

export interface CreateAttachmentData {
  uploaderId: string;
  fileName: string;
  contentType: string;
  size: number;
  storageKey: string;
}

/** Every query filters by workspaceId and taskId. */
@Injectable()
export class AttachmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Only READY files: pending uploads are invisible to everyone. */
  listReady(
    workspaceId: string,
    taskId: string,
  ): Promise<AttachmentWithUploader[]> {
    return this.prisma.attachment.findMany({
      where: { workspaceId, taskId, status: 'READY' },
      include: attachmentInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  find(
    workspaceId: string,
    taskId: string,
    attachmentId: string,
  ): Promise<AttachmentWithUploader | null> {
    return this.prisma.attachment.findFirst({
      where: { id: attachmentId, workspaceId, taskId },
      include: attachmentInclude,
    });
  }

  create(
    workspaceId: string,
    taskId: string,
    data: CreateAttachmentData,
  ): Promise<AttachmentWithUploader> {
    return this.prisma.attachment.create({
      data: { ...data, workspaceId, taskId },
      include: attachmentInclude,
    });
  }

  markReady(attachmentId: string): Promise<AttachmentWithUploader> {
    return this.prisma.attachment.update({
      where: { id: attachmentId },
      data: { status: 'READY' },
      include: attachmentInclude,
    });
  }

  /** Throws Prisma P2025 if it is not on this task/workspace. */
  async delete(
    workspaceId: string,
    taskId: string,
    attachmentId: string,
  ): Promise<void> {
    await this.prisma.attachment.delete({
      where: { id: attachmentId, workspaceId, taskId },
    });
  }

  /** Abandoned uploads (no "complete" call) older than `before`. */
  findStalePending(
    before: Date,
    take: number,
  ): Promise<{ id: string; storageKey: string }[]> {
    return this.prisma.attachment.findMany({
      where: { status: 'PENDING', createdAt: { lt: before } },
      select: { id: true, storageKey: true },
      take,
    });
  }

  async deleteMany(ids: string[]): Promise<void> {
    await this.prisma.attachment.deleteMany({ where: { id: { in: ids } } });
  }
}
