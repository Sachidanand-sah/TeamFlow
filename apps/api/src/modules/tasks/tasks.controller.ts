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
import { TaskDto } from '@teamflow/shared';
import { CurrentMember } from '../workspaces/decorators/current-member.decorator';
import {
  RequireWorkspaceRole,
  WorkspaceRoleGuard,
} from '../workspaces/guards/workspace-role.guard';
import { WorkspaceMember } from '../workspaces/workspace-member';
import { CreateTaskDto, MoveTaskDto, UpdateTaskDto } from './dto/task.dto';
import { TasksService } from './tasks.service';

@UseGuards(WorkspaceRoleGuard)
@Controller('workspaces/:workspaceId/projects/:projectId/tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @RequireWorkspaceRole('VIEWER')
  @Get()
  list(
    @CurrentMember() member: WorkspaceMember,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<TaskDto[]> {
    return this.tasks.list(member, projectId);
  }

  @RequireWorkspaceRole('MEMBER')
  @Post()
  create(
    @CurrentMember() member: WorkspaceMember,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateTaskDto,
  ): Promise<TaskDto> {
    return this.tasks.create(member, projectId, dto);
  }

  @RequireWorkspaceRole('VIEWER')
  @Get(':taskId')
  get(
    @CurrentMember() member: WorkspaceMember,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ): Promise<TaskDto> {
    return this.tasks.get(member, projectId, taskId);
  }

  @RequireWorkspaceRole('MEMBER')
  @Patch(':taskId')
  update(
    @CurrentMember() member: WorkspaceMember,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskDto> {
    return this.tasks.update(member, projectId, taskId, dto);
  }

  /** A POST action rather than PATCH status: a move changes other tasks' order too. */
  @RequireWorkspaceRole('MEMBER')
  @Post(':taskId/move')
  @HttpCode(HttpStatus.OK)
  move(
    @CurrentMember() member: WorkspaceMember,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: MoveTaskDto,
  ): Promise<TaskDto> {
    return this.tasks.move(member, projectId, taskId, dto);
  }

  /** MEMBER minimum; TasksService allows only the reporter or an admin. */
  @RequireWorkspaceRole('MEMBER')
  @Delete(':taskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentMember() member: WorkspaceMember,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ): Promise<void> {
    return this.tasks.delete(member, projectId, taskId);
  }
}
