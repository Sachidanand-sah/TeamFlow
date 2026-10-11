import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  COMMENT_MAX_LENGTH,
  CommentDto,
  CreateCommentRequest,
  UpdateCommentRequest,
} from '@teamflow/shared';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { CurrentMember } from '../workspaces/decorators/current-member.decorator';
import {
  RequireWorkspaceRole,
  WorkspaceRoleGuard,
} from '../workspaces/guards/workspace-role.guard';
import { WorkspaceMember } from '../workspaces/workspace-member';
import { CommentsService } from './comments.service';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CommentBodyDto
  implements CreateCommentRequest, UpdateCommentRequest
{
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(COMMENT_MAX_LENGTH)
  body!: string;
}

@UseGuards(WorkspaceRoleGuard)
@Controller(
  'workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments',
)
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @RequireWorkspaceRole('VIEWER')
  @Get()
  list(
    @CurrentMember() member: WorkspaceMember,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ): Promise<CommentDto[]> {
    return this.comments.list(member, projectId, taskId);
  }

  @RequireWorkspaceRole('MEMBER')
  @Post()
  create(
    @CurrentMember() member: WorkspaceMember,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CommentBodyDto,
  ): Promise<CommentDto> {
    return this.comments.create(member, projectId, taskId, dto.body);
  }

  /** MEMBER minimum; CommentsService allows only the author. */
  @RequireWorkspaceRole('MEMBER')
  @Patch(':commentId')
  update(
    @CurrentMember() member: WorkspaceMember,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: CommentBodyDto,
  ): Promise<CommentDto> {
    return this.comments.update(member, projectId, taskId, commentId, dto.body);
  }

  /** MEMBER minimum; CommentsService allows the author or an admin. */
  @RequireWorkspaceRole('MEMBER')
  @Delete(':commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentMember() member: WorkspaceMember,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ): Promise<void> {
    return this.comments.delete(member, projectId, taskId, commentId);
  }
}
