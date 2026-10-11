import { Injectable, Logger } from '@nestjs/common';
import {
  ACTIVITY_PAGE_SIZE,
  ActivityDataByType,
  ActivityDto,
  ActivityPage,
  ActivityType,
} from '@teamflow/shared';
import { DomainEvents } from '../../events/domain-events';
import { Prisma } from '../../generated/prisma/client';
import { ProjectsService } from '../projects/projects.service';
import { WorkspaceMember } from '../workspaces/workspace-member';
import { ActivityRepository, ActivityWithActor } from './activity.repository';

/** What a service reports; `type` decides the shape of `data` at compile time. */
export type RecordActivityInput = {
  [K in ActivityType]: {
    workspaceId: string;
    projectId: string;
    taskId: string | null;
    taskKey: string;
    actorId: string;
    type: K;
    data: ActivityDataByType[K];
  };
}[ActivityType];

export function toActivityDto(row: ActivityWithActor): ActivityDto {
  // `data` is JSON from the database. Only `record()` writes it, with the typed
  // input above, so the shape matches `type`; the cast states that invariant.
  return {
    id: row.id,
    projectId: row.projectId,
    taskId: row.taskId,
    taskKey: row.taskKey,
    actor: row.actor ? { userId: row.actor.id, name: row.actor.name } : null,
    createdAt: row.createdAt.toISOString(),
    type: row.type,
    data: row.data,
  } as ActivityDto;
}

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    private readonly activities: ActivityRepository,
    private readonly projects: ProjectsService,
    private readonly events: DomainEvents,
  ) {}

  /**
   * Saves an activity entry and publishes it on the event bus.
   *
   * WHY it never throws: it runs after the user's change already succeeded. Failing
   * the request now would tell the user "error" for a change that did happen. A lost
   * history line is the smaller problem, so it is logged instead.
   */
  async record(input: RecordActivityInput): Promise<void> {
    try {
      const row = await this.activities.create({
        ...input,
        // Plain JSON objects built from typed input (see RecordActivityInput).
        data: input.data as unknown as Prisma.InputJsonValue,
      });
      this.events.publish({
        workspaceId: input.workspaceId,
        event: {
          type: 'activity.recorded',
          activity: toActivityDto(row),
          projectId: input.projectId,
          actorId: input.actorId,
        },
      });
    } catch (error) {
      this.logger.error(
        `Could not record ${input.type} for ${input.taskKey}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async list(
    member: WorkspaceMember,
    projectId: string,
    query: { taskId?: string; cursor?: string },
  ): Promise<ActivityPage> {
    // 404 if the project is not in this workspace (instead of an empty feed).
    await this.projects.get(member, projectId);

    // Fetch one extra row to know whether another page exists.
    const rows = await this.activities.list(member.workspaceId, projectId, {
      ...query,
      take: ACTIVITY_PAGE_SIZE + 1,
    });
    const hasMore = rows.length > ACTIVITY_PAGE_SIZE;
    const page = rows.slice(0, ACTIVITY_PAGE_SIZE);
    return {
      items: page.map(toActivityDto),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }
}
