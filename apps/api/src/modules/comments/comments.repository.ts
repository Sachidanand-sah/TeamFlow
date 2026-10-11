import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const commentInclude = {
  author: { select: { id: true, name: true } },
} satisfies Prisma.CommentInclude;

export type CommentWithAuthor = Prisma.CommentGetPayload<{
  include: typeof commentInclude;
}>;

/** Every query filters by workspaceId and taskId, never by comment id alone. */
@Injectable()
export class CommentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(workspaceId: string, taskId: string): Promise<CommentWithAuthor[]> {
    return this.prisma.comment.findMany({
      where: { workspaceId, taskId },
      include: commentInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  find(
    workspaceId: string,
    taskId: string,
    commentId: string,
  ): Promise<CommentWithAuthor | null> {
    return this.prisma.comment.findFirst({
      where: { id: commentId, workspaceId, taskId },
      include: commentInclude,
    });
  }

  create(
    workspaceId: string,
    taskId: string,
    authorId: string,
    body: string,
  ): Promise<CommentWithAuthor> {
    return this.prisma.comment.create({
      data: { workspaceId, taskId, authorId, body },
      include: commentInclude,
    });
  }

  /** Throws Prisma P2025 if the comment is not on this task/workspace. */
  updateBody(
    workspaceId: string,
    taskId: string,
    commentId: string,
    body: string,
  ): Promise<CommentWithAuthor> {
    return this.prisma.comment.update({
      where: { id: commentId, workspaceId, taskId },
      data: { body, editedAt: new Date() },
      include: commentInclude,
    });
  }

  /** Throws Prisma P2025 if the comment is not on this task/workspace. */
  async delete(
    workspaceId: string,
    taskId: string,
    commentId: string,
  ): Promise<void> {
    await this.prisma.comment.delete({
      where: { id: commentId, workspaceId, taskId },
    });
  }
}
