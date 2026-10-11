import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ActivityPage } from '@teamflow/shared';
import { IsOptional, IsUUID } from 'class-validator';
import { CurrentMember } from '../workspaces/decorators/current-member.decorator';
import {
  RequireWorkspaceRole,
  WorkspaceRoleGuard,
} from '../workspaces/guards/workspace-role.guard';
import { WorkspaceMember } from '../workspaces/workspace-member';
import { ActivityService } from './activity.service';

/** Query strings are client input too: validated like any body. */
export class ActivityQueryDto {
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @IsUUID()
  cursor?: string;
}

@UseGuards(WorkspaceRoleGuard)
@Controller('workspaces/:workspaceId/projects/:projectId/activity')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @RequireWorkspaceRole('VIEWER')
  @Get()
  list(
    @CurrentMember() member: WorkspaceMember,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ActivityQueryDto,
  ): Promise<ActivityPage> {
    return this.activity.list(member, projectId, query);
  }
}
