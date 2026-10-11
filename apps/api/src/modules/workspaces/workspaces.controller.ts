import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceDto } from '@teamflow/shared';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentMember } from './decorators/current-member.decorator';
import {
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
} from './dto/workspace-name.dto';
import {
  RequireWorkspaceRole,
  WorkspaceRoleGuard,
} from './guards/workspace-role.guard';
import { WorkspaceMember } from './workspace-member';
import { WorkspacesService } from './workspaces.service';

/** `/workspaces`: the caller's own list. Needs a login, not a membership. */
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<WorkspaceDto[]> {
    return this.workspaces.listForUser(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWorkspaceDto,
  ): Promise<WorkspaceDto> {
    return this.workspaces.create(user.id, dto.name);
  }
}

/** `/workspaces/:workspaceId`: every route checks membership via WorkspaceRoleGuard. */
@UseGuards(WorkspaceRoleGuard)
@Controller('workspaces/:workspaceId')
export class WorkspaceController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @RequireWorkspaceRole('VIEWER')
  @Get()
  get(@CurrentMember() member: WorkspaceMember): Promise<WorkspaceDto> {
    return this.workspaces.get(member);
  }

  @RequireWorkspaceRole('ADMIN')
  @Patch()
  rename(
    @CurrentMember() member: WorkspaceMember,
    @Body() dto: UpdateWorkspaceDto,
  ): Promise<WorkspaceDto> {
    return this.workspaces.rename(member, dto.name);
  }

  @RequireWorkspaceRole('OWNER')
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@CurrentMember() member: WorkspaceMember): Promise<void> {
    return this.workspaces.delete(member);
  }
}
