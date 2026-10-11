import { Injectable } from '@nestjs/common';
import { AssignableWorkspaceRole } from '@teamflow/shared';
import { Membership, User } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type MemberUser = Pick<User, 'id' | 'name' | 'email'>;
export type MembershipWithUser = Membership & { user: MemberUser };

/** Only the fields a member list needs: never select passwordHash by accident. */
const memberUserSelect = { id: true, name: true, email: true } as const;

/**
 * Every query takes `workspaceId` and filters by it. This is the multi-tenancy rule
 * in practice: a userId alone is never enough to reach a membership, so a bug in one
 * workspace's code path cannot leak or modify another workspace's data.
 */
@Injectable()
export class MembershipsRepository {
  constructor(private readonly prisma: PrismaService) {}

  find(workspaceId: string, userId: string): Promise<Membership | null> {
    return this.prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
  }

  list(workspaceId: string): Promise<MembershipWithUser[]> {
    return this.prisma.membership.findMany({
      where: { workspaceId },
      include: { user: { select: memberUserSelect } },
      orderBy: { createdAt: 'asc' },
    });
  }

  create(
    workspaceId: string,
    userId: string,
    role: AssignableWorkspaceRole,
  ): Promise<MembershipWithUser> {
    return this.prisma.membership.create({
      data: { workspaceId, userId, role },
      include: { user: { select: memberUserSelect } },
    });
  }

  updateRole(
    workspaceId: string,
    userId: string,
    role: AssignableWorkspaceRole,
  ): Promise<MembershipWithUser> {
    return this.prisma.membership.update({
      where: { workspaceId_userId: { workspaceId, userId } },
      data: { role },
      include: { user: { select: memberUserSelect } },
    });
  }

  async delete(workspaceId: string, userId: string): Promise<void> {
    await this.prisma.membership.delete({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
  }
}
