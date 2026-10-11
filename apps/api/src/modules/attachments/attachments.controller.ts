import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ALLOWED_ATTACHMENT_TYPES,
  AllowedAttachmentType,
  ATTACHMENT_MAX_BYTES,
  AttachmentDownload,
  AttachmentDto,
  CreateAttachmentRequest,
  CreateAttachmentResponse,
} from '@teamflow/shared';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CurrentMember } from '../workspaces/decorators/current-member.decorator';
import {
  RequireWorkspaceRole,
  WorkspaceRoleGuard,
} from '../workspaces/guards/workspace-role.guard';
import { WorkspaceMember } from '../workspaces/workspace-member';
import { AttachmentsService } from './attachments.service';

export class CreateAttachmentDto implements CreateAttachmentRequest {
  /** Sanitised by the service; this only bounds the input. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  fileName!: string;

  @IsIn(ALLOWED_ATTACHMENT_TYPES)
  contentType!: AllowedAttachmentType;

  @IsInt()
  @Min(1)
  @Max(ATTACHMENT_MAX_BYTES)
  size!: number;
}

@UseGuards(WorkspaceRoleGuard)
@Controller(
  'workspaces/:workspaceId/projects/:projectId/tasks/:taskId/attachments',
)
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @RequireWorkspaceRole('VIEWER')
  @Get()
  list(
    @CurrentMember() member: WorkspaceMember,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ): Promise<AttachmentDto[]> {
    return this.attachments.list(member, projectId, taskId);
  }

  @RequireWorkspaceRole('MEMBER')
  @Post()
  create(
    @CurrentMember() member: WorkspaceMember,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateAttachmentDto,
  ): Promise<CreateAttachmentResponse> {
    return this.attachments.create(member, projectId, taskId, dto);
  }

  @RequireWorkspaceRole('MEMBER')
  @Post(':attachmentId/complete')
  @HttpCode(HttpStatus.OK)
  complete(
    @CurrentMember() member: WorkspaceMember,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ): Promise<AttachmentDto> {
    return this.attachments.complete(member, projectId, taskId, attachmentId);
  }

  /** Returns a short-lived URL as JSON (a redirect would not carry our Bearer token). */
  @RequireWorkspaceRole('VIEWER')
  @Get(':attachmentId/download')
  download(
    @CurrentMember() member: WorkspaceMember,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ): Promise<AttachmentDownload> {
    return this.attachments.download(member, projectId, taskId, attachmentId);
  }

  /** MEMBER minimum; the service allows the uploader or an admin. */
  @RequireWorkspaceRole('MEMBER')
  @Delete(':attachmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentMember() member: WorkspaceMember,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ): Promise<void> {
    return this.attachments.delete(member, projectId, taskId, attachmentId);
  }
}
