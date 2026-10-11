import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface NotificationTask {
  id: string;
  projectId: string;
  key: string;
  title: string;
  reporterId: string | null;
  assigneeUserId: string | null;
}

export interface NotificationRecipient {
  userId: string;
  email: string;
  name: string;
}

/** Read-only queries the workers need. All tenant-scoped by workspaceId. */
@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findTask(
    workspaceId: string,
    taskId: string,
  ): Promise<NotificationTask | null> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId },
      select: {
        id: true,
        projectId: true,
        number: true,
        title: true,
        reporterId: true,
        project: { select: { key: true } },
        assignee: { select: { userId: true } },
      },
    });
    if (!task) return null;
    return {
      id: task.id,
      projectId: task.projectId,
      key: `${task.project.key}-${task.number}`,
      title: task.title,
      reporterId: task.reporterId,
      assigneeUserId: task.assignee?.userId ?? null,
    };
  }

  /**
   * The user, ONLY if they are still a member of the workspace.
   * WHY: someone removed from a team must stop receiving its emails immediately.
   */
  async findMember(
    workspaceId: string,
    userId: string,
  ): Promise<NotificationRecipient | null> {
    const membership = await this.prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { user: { select: { id: true, email: true, name: true } } },
    });
    return membership
      ? {
          userId: membership.user.id,
          email: membership.user.email,
          name: membership.user.name,
        }
      : null;
  }

  async findUserName(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    return user?.name ?? null;
  }

  findComment(
    workspaceId: string,
    taskId: string,
    commentId: string,
  ): Promise<{ body: string } | null> {
    return this.prisma.comment.findFirst({
      where: { id: commentId, workspaceId, taskId },
      select: { body: true },
    });
  }
}
