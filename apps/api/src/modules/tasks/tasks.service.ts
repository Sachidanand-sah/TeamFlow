import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BoardEventPayload,
  canDeleteTask,
  CreateTaskRequest,
  formatTaskKey,
  MoveTaskRequest,
  TaskDto,
  TrackedTaskField,
  UpdateTaskRequest,
} from '@teamflow/shared';
import { DomainEvents } from '../../events/domain-events';
import { orNotFound } from '../../prisma/prisma-errors';
import { ActivityService } from '../activity/activity.service';
import { ProjectsService } from '../projects/projects.service';
import { MembershipsRepository } from '../workspaces/memberships.repository';
import { WorkspaceMember } from '../workspaces/workspace-member';
import {
  TasksRepository,
  TaskWithRelations,
  UpdateTaskData,
} from './tasks.repository';

const TASK_NOT_FOUND = 'Task not found';
const PROJECT_NOT_FOUND = 'Project not found';

export function toTaskDto(task: TaskWithRelations): TaskDto {
  return {
    id: task.id,
    projectId: task.projectId,
    number: task.number,
    key: formatTaskKey(task.project.key, task.number),
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    position: task.position,
    assignee: task.assignee
      ? { userId: task.assignee.user.id, name: task.assignee.user.name }
      : null,
    reporter: task.reporter
      ? { userId: task.reporter.id, name: task.reporter.name }
      : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function normalizeDescription(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Which tracked fields differ between two versions of a task. */
export function changedFields(
  before: TaskWithRelations,
  after: TaskWithRelations,
): TrackedTaskField[] {
  const fields: TrackedTaskField[] = [];
  if (before.title !== after.title) fields.push('title');
  if (before.description !== after.description) fields.push('description');
  if (before.priority !== after.priority) fields.push('priority');
  if (before.assigneeMembershipId !== after.assigneeMembershipId) {
    fields.push('assignee');
  }
  return fields;
}

/**
 * The guard has checked the minimum role (VIEWER reads, MEMBER writes). This service
 * adds the rules that depend on data: the assignee must be a member of THIS
 * workspace, and only the reporter or an admin may delete a task.
 *
 * After every successful change it records activity and publishes a board event.
 */
@Injectable()
export class TasksService {
  constructor(
    private readonly tasks: TasksRepository,
    private readonly projects: ProjectsService,
    private readonly memberships: MembershipsRepository,
    private readonly activity: ActivityService,
    private readonly events: DomainEvents,
  ) {}

  async list(member: WorkspaceMember, projectId: string): Promise<TaskDto[]> {
    // Distinguish "project has no tasks" ([]) from "no such project here" (404).
    await this.projects.get(member, projectId);
    const tasks = await this.tasks.list(member.workspaceId, projectId);
    return tasks.map(toTaskDto);
  }

  async get(
    member: WorkspaceMember,
    projectId: string,
    taskId: string,
  ): Promise<TaskDto> {
    return toTaskDto(await this.findOrFail(member, projectId, taskId));
  }

  async create(
    member: WorkspaceMember,
    projectId: string,
    request: CreateTaskRequest,
  ): Promise<TaskDto> {
    const assigneeMembershipId = await this.resolveAssignee(
      member,
      request.assigneeId,
    );
    const task = await orNotFound(
      this.tasks.create(member.workspaceId, projectId, {
        title: request.title.trim(),
        description: normalizeDescription(request.description),
        status: request.status ?? 'TODO',
        priority: request.priority ?? 'MEDIUM',
        assigneeMembershipId: assigneeMembershipId ?? null,
        reporterId: member.userId,
      }),
      PROJECT_NOT_FOUND,
    );
    const dto = toTaskDto(task);

    this.publish(member, projectId, { type: 'task.upserted', task: dto });
    await this.activity.record({
      ...this.activityBase(member, task),
      type: 'TASK_CREATED',
      data: dto.assignee
        ? { title: task.title, assignee: dto.assignee }
        : { title: task.title },
    });
    return dto;
  }

  async update(
    member: WorkspaceMember,
    projectId: string,
    taskId: string,
    request: UpdateTaskRequest,
  ): Promise<TaskDto> {
    const before = await this.findOrFail(member, projectId, taskId);

    // undefined = leave unchanged; null = clear (description / assignee).
    const data: UpdateTaskData = {};
    if (request.title !== undefined) {
      data.title = request.title.trim();
    }
    if (request.description !== undefined) {
      data.description = normalizeDescription(request.description);
    }
    if (request.priority !== undefined) {
      data.priority = request.priority;
    }
    if (request.assigneeId !== undefined) {
      data.assigneeMembershipId = await this.resolveAssignee(
        member,
        request.assigneeId,
      );
    }

    const after = await orNotFound(
      this.tasks.update(member.workspaceId, projectId, taskId, data),
      TASK_NOT_FOUND,
    );
    const dto = toTaskDto(after);

    const fields = changedFields(before, after);
    if (fields.length > 0) {
      this.publish(member, projectId, { type: 'task.upserted', task: dto });
      await this.activity.record({
        ...this.activityBase(member, after),
        type: 'TASK_UPDATED',
        data: fields.includes('assignee')
          ? { fields, assignee: dto.assignee }
          : { fields },
      });
    }
    return dto;
  }

  async move(
    member: WorkspaceMember,
    projectId: string,
    taskId: string,
    request: MoveTaskRequest,
  ): Promise<TaskDto> {
    const before = await this.findOrFail(member, projectId, taskId);
    const task = await this.tasks.move(
      member.workspaceId,
      projectId,
      taskId,
      request.status,
      request.index,
    );
    if (!task) {
      throw new NotFoundException(TASK_NOT_FOUND);
    }

    this.publish(member, projectId, {
      type: 'task.moved',
      taskId,
      status: request.status,
      index: request.index,
    });
    // Reordering inside a column is not history worth recording; a status change is.
    if (before.status !== task.status) {
      await this.activity.record({
        ...this.activityBase(member, task),
        type: 'TASK_MOVED',
        data: { from: before.status, to: task.status },
      });
    }
    return toTaskDto(task);
  }

  async delete(
    member: WorkspaceMember,
    projectId: string,
    taskId: string,
  ): Promise<void> {
    const task = await this.findOrFail(member, projectId, taskId);
    if (!canDeleteTask(member.role, task.reporterId === member.userId)) {
      throw new ForbiddenException(
        'Only the reporter or an admin can delete this task',
      );
    }
    await orNotFound(
      this.tasks.delete(member.workspaceId, projectId, taskId),
      TASK_NOT_FOUND,
    );

    this.publish(member, projectId, { type: 'task.deleted', taskId });
    await this.activity.record({
      ...this.activityBase(member, task),
      taskId: null, // the row is gone; the key snapshot keeps the entry readable
      type: 'TASK_DELETED',
      data: { title: task.title },
    });
  }

  private async findOrFail(
    member: WorkspaceMember,
    projectId: string,
    taskId: string,
  ): Promise<TaskWithRelations> {
    const task = await this.tasks.find(member.workspaceId, projectId, taskId);
    if (!task) {
      throw new NotFoundException(TASK_NOT_FOUND);
    }
    return task;
  }

  private activityBase(member: WorkspaceMember, task: TaskWithRelations) {
    return {
      workspaceId: member.workspaceId,
      projectId: task.projectId,
      taskId: task.id,
      taskKey: formatTaskKey(task.project.key, task.number),
      actorId: member.userId,
    };
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

  /**
   * Turns a userId from the client into a membership id IN THIS workspace.
   * WHY: otherwise a client could assign a task to any user id, e.g. someone from
   * another team, who would then show up on this board.
   */
  private async resolveAssignee(
    member: WorkspaceMember,
    assigneeId: string | null | undefined,
  ): Promise<string | null | undefined> {
    if (assigneeId === undefined || assigneeId === null) {
      return assigneeId;
    }
    const membership = await this.memberships.find(
      member.workspaceId,
      assigneeId,
    );
    if (!membership) {
      throw new BadRequestException(
        'The assignee must be a member of this workspace',
      );
    }
    return membership.id;
  }
}
