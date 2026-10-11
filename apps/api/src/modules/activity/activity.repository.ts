import { Injectable } from '@nestjs/common';
import { ActivityType } from '@teamflow/shared';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const activityInclude = {
  actor: { select: { id: true, name: true } },
} satisfies Prisma.ActivityInclude;

export type ActivityWithActor = Prisma.ActivityGetPayload<{
  include: typeof activityInclude;
}>;

export interface CreateActivityData {
  workspaceId: string;
  projectId: string;
  taskId: string | null;
  taskKey: string;
  actorId: string;
  type: ActivityType;
  data: Prisma.InputJsonValue;
}

export interface ListActivityQuery {
  taskId?: string;
  /** id of the last entry of the previous page. */
  cursor?: string;
  take: number;
}

@Injectable()
export class ActivityRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateActivityData): Promise<ActivityWithActor> {
    return this.prisma.activity.create({ data, include: activityInclude });
  }

  /**
   * Newest first, keyset ("cursor") pagination.
   * WHY not OFFSET: with offset, rows inserted while you scroll shift every page and
   * you see duplicates; a cursor continues exactly after the last row you saw.
   */
  list(
    workspaceId: string,
    projectId: string,
    query: ListActivityQuery,
  ): Promise<ActivityWithActor[]> {
    return this.prisma.activity.findMany({
      where: {
        workspaceId,
        projectId,
        ...(query.taskId ? { taskId: query.taskId } : {}),
      },
      include: activityInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.take,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
  }
}
