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
import { ProjectDto } from '@teamflow/shared';
import { CurrentMember } from '../workspaces/decorators/current-member.decorator';
import {
  RequireWorkspaceRole,
  WorkspaceRoleGuard,
} from '../workspaces/guards/workspace-role.guard';
import { WorkspaceMember } from '../workspaces/workspace-member';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { ProjectsService } from './projects.service';

@UseGuards(WorkspaceRoleGuard)
@Controller('workspaces/:workspaceId/projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @RequireWorkspaceRole('VIEWER')
  @Get()
  list(@CurrentMember() member: WorkspaceMember): Promise<ProjectDto[]> {
    return this.projects.list(member);
  }

  @RequireWorkspaceRole('ADMIN')
  @Post()
  create(
    @CurrentMember() member: WorkspaceMember,
    @Body() dto: CreateProjectDto,
  ): Promise<ProjectDto> {
    return this.projects.create(member, dto);
  }

  @RequireWorkspaceRole('VIEWER')
  @Get(':projectId')
  get(
    @CurrentMember() member: WorkspaceMember,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<ProjectDto> {
    return this.projects.get(member, projectId);
  }

  @RequireWorkspaceRole('ADMIN')
  @Patch(':projectId')
  update(
    @CurrentMember() member: WorkspaceMember,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectDto> {
    return this.projects.update(member, projectId, dto);
  }

  @RequireWorkspaceRole('ADMIN')
  @Delete(':projectId')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentMember() member: WorkspaceMember,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<void> {
    return this.projects.delete(member, projectId);
  }
}
