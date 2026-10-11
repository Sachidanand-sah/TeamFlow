import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BoardEventPayload,
  canDeleteComment,
  canEditComment,
  CommentDto,
} from '@teamflow/shared';
import { DomainEvents } from '../../events/domain-events';
import { orNotFound } from '../../prisma/prisma-errors';
import { ActivityService } from '../activity/activity.service';
import { TasksService } from '../tasks/tasks.service';
import { WorkspaceMember } from '../workspaces/workspace-member';
import { CommentsRepository, CommentWithAuthor } from './comments.repository';

const COMMENT_NOT_FOUND = 'Comment not found';
const EXCERPT_LENGTH = 140;

export function toCommentDto(comment: CommentWithAuthor): CommentDto {
  return {
    id: comment.id,
    taskId: comment.taskId,
    author: comment.author
      ? { userId: comment.author.id, name: comment.author.name }
      : null,
    body: comment.body,
    editedAt: comment.editedAt?.toISOString() ?? null,
    createdAt: comment.createdAt.toISOString(),
  };
}

function excerpt(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > EXCERPT_LENGTH
    ? `${flat.slice(0, EXCERPT_LENGTH - 1)}…`
    : flat;
}

/**
 * Every method first resolves the task through TasksService, which 404s unless the
 * task belongs to this project AND workspace. Only then are comments touched.
 */
@Injectable()
export class CommentsService {
  constructor(
    private readonly comments: CommentsRepository,
    private readonly tasks: TasksService,
    private readonly activity: ActivityService,
    private readonly events: DomainEvents,
  ) {}

  async list(
    member: WorkspaceMember,
    projectId: string,
    taskId: string,
  ): Promise<CommentDto[]> {
    await this.tasks.get(member, projectId, taskId);
    const comments = await this.comments.list(member.workspaceId, taskId);
    return comments.map(toCommentDto);
  }

  async create(
    member: WorkspaceMember,
    projectId: string,
    taskId: string,
    body: string,
  ): Promise<CommentDto> {
    const task = await this.tasks.get(member, projectId, taskId);
    const comment = await this.comments.create(
      member.workspaceId,
      taskId,
      member.userId,
      body.trim(),
    );
    const dto = toCommentDto(comment);

    this.publish(member, projectId, { type: 'comment.upserted', comment: dto });
    await this.activity.record({
      workspaceId: member.workspaceId,
      projectId,
      taskId,
      taskKey: task.key,
      actorId: member.userId,
      type: 'COMMENT_ADDED',
      data: { commentId: comment.id, excerpt: excerpt(comment.body) },
    });
    return dto;
  }

  async update(
    member: WorkspaceMember,
    projectId: string,
    taskId: string,
    commentId: string,
    body: string,
  ): Promise<CommentDto> {
    const existing = await this.findOrFail(
      member,
      projectId,
      taskId,
      commentId,
    );
    if (!canEditComment(member.role, existing.authorId === member.userId)) {
      throw new ForbiddenException('Only the author can edit a comment');
    }
    const updated = await orNotFound(
      this.comments.updateBody(
        member.workspaceId,
        taskId,
        commentId,
        body.trim(),
      ),
      COMMENT_NOT_FOUND,
    );
    const dto = toCommentDto(updated);
    this.publish(member, projectId, { type: 'comment.upserted', comment: dto });
    return dto;
  }

  async delete(
    member: WorkspaceMember,
    projectId: string,
    taskId: string,
    commentId: string,
  ): Promise<void> {
    const existing = await this.findOrFail(
      member,
      projectId,
      taskId,
      commentId,
    );
    if (!canDeleteComment(member.role, existing.authorId === member.userId)) {
      throw new ForbiddenException(
        'Only the author or an admin can delete a comment',
      );
    }
    await orNotFound(
      this.comments.delete(member.workspaceId, taskId, commentId),
      COMMENT_NOT_FOUND,
    );
    this.publish(member, projectId, {
      type: 'comment.deleted',
      taskId,
      commentId,
    });
  }

  private async findOrFail(
    member: WorkspaceMember,
    projectId: string,
    taskId: string,
    commentId: string,
  ): Promise<CommentWithAuthor> {
    await this.tasks.get(member, projectId, taskId);
    const comment = await this.comments.find(
      member.workspaceId,
      taskId,
      commentId,
    );
    if (!comment) {
      throw new NotFoundException(COMMENT_NOT_FOUND);
    }
    return comment;
  }

  private publish(
    member: WorkspaceMember,
    projectId: string,
    payload: BoardEventPayload,
  ): void {
    this.events.publish({
      workspaceId: member.workspaceId,
      event: { ...payload, projectId, actorId: member.userId },
    });
  }
}
