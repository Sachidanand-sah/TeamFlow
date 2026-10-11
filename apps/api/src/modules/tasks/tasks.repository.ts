import { Injectable } from '@nestjs/common';
import { moveTask, TaskStatus } from '@teamflow/shared';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Relations every task response needs (project key for "WEB-12", people's names). */
const taskInclude = {
  project: { select: { key: true } },
  assignee: { select: { user: { select: { id: true, name: true } } } },
  reporter: { select: { id: true, name: true } },
} satisfies Prisma.TaskInclude;

export type TaskWithRelations = Prisma.TaskGetPayload<{
  include: typeof taskInclude;
}>;

export interface CreateTaskData {
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Prisma.TaskCreateInput['priority'];
  assigneeMembershipId: string | null;
  reporterId: string;
}

export interface UpdateTaskData {
  title?: string;
  description?: string | null;
  priority?: Prisma.TaskUpdateInput['priority'];
  assigneeMembershipId?: string | null;
}

/**
 * Every query filters by workspaceId AND projectId (tenant + parent), never by the
 * task id alone. See ProjectsRepository for why.
 */
@Injectable()
export class TasksRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The whole board: Postgres sorts enums in declaration order (TODO first). */
  list(workspaceId: string, projectId: string): Promise<TaskWithRelations[]> {
    return this.prisma.task.findMany({
      where: { workspaceId, projectId },
      include: taskInclude,
      orderBy: [{ status: 'asc' }, { position: 'asc' }],
    });
  }

  find(
    workspaceId: string,
    projectId: string,
    taskId: string,
  ): Promise<TaskWithRelations | null> {
    return this.prisma.task.findFirst({
      where: { id: taskId, workspaceId, projectId },
      include: taskInclude,
    });
  }

  /**
   * Allocates the next task number and appends the task to the bottom of its column.
   * Throws Prisma P2025 if the project is not in this workspace.
   *
   * WHY increment the counter first: `UPDATE projects SET task_counter = task_counter + 1`
   * takes a row lock on the project until the transaction ends. A concurrent create in
   * the same project waits at that line, so numbers and positions never collide.
   */
  create(
    workspaceId: string,
    projectId: string,
    data: CreateTaskData,
  ): Promise<TaskWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const { taskCounter } = await tx.project.update({
        where: { id: projectId, workspaceId },
        data: { taskCounter: { increment: 1 } },
        select: { taskCounter: true },
      });
      // max + 1, not count: deletions leave gaps, and count could then reuse a position.
      const { _max } = await tx.task.aggregate({
        where: { projectId, status: data.status },
        _max: { position: true },
      });
      const position = (_max.position ?? -1) + 1;
      return tx.task.create({
        data: {
          ...data,
          workspaceId,
          projectId,
          number: taskCounter,
          position,
        },
        include: taskInclude,
      });
    });
  }

  /** Throws Prisma P2025 if the task is not in this project/workspace. */
  update(
    workspaceId: string,
    projectId: string,
    taskId: string,
    data: UpdateTaskData,
  ): Promise<TaskWithRelations> {
    return this.prisma.task.update({
      where: { id: taskId, workspaceId, projectId },
      data,
      include: taskInclude,
    });
  }

  /**
   * Moves a task and renumbers the affected column(s). Returns null if the task is not
   * in this project/workspace.
   *
   * WHY `SELECT ... FOR UPDATE` on the project: two people dragging cards on the same
   * board at once would otherwise read the same column, compute different orders and
   * interleave their writes. Locking the project row serialises moves per board
   * (other projects are unaffected). The raw query is a tagged template, so Prisma
   * sends the ids as bound parameters, not string-concatenated SQL.
   */
  move(
    workspaceId: string,
    projectId: string,
    taskId: string,
    status: TaskStatus,
    index: number,
  ): Promise<TaskWithRelations | null> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM projects
        WHERE id = ${projectId}::uuid AND workspace_id = ${workspaceId}::uuid
        FOR UPDATE`;
      if (locked.length === 0) {
        return null;
      }

      const moving = await tx.task.findFirst({
        where: { id: taskId, workspaceId, projectId },
        select: { status: true },
      });
      if (!moving) {
        return null;
      }

      // Only the source and target columns can change.
      const affected = await tx.task.findMany({
        where: { projectId, status: { in: [moving.status, status] } },
        select: { id: true, status: true, position: true },
      });
      const before = new Map(affected.map((t) => [t.id, t]));
      const after = moveTask(affected, taskId, status, index);

      for (const task of after) {
        const old = before.get(task.id);
        if (old?.status !== task.status || old.position !== task.position) {
          await tx.task.update({
            where: { id: task.id },
            data: { status: task.status, position: task.position },
          });
        }
      }

      return tx.task.findUniqueOrThrow({
        where: { id: taskId },
        include: taskInclude,
      });
    });
  }

  /** Throws Prisma P2025 if the task is not in this project/workspace. */
  async delete(
    workspaceId: string,
    projectId: string,
    taskId: string,
  ): Promise<void> {
    await this.prisma.task.delete({
      where: { id: taskId, workspaceId, projectId },
    });
  }
}
