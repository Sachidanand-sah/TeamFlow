import { Injectable } from '@nestjs/common';
import { Membership, Workspace } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type MembershipWithWorkspace = Membership & { workspace: Workspace };

@Injectable()
export class WorkspacesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates the workspace and its OWNER membership in one statement.
   * WHY a nested write: Prisma runs it in a single transaction, so there can never be
   * a workspace without an owner (which nobody could then manage or delete).
   */
  createWithOwner(
    name: string,
    ownerId: string,
  ): Promise<MembershipWithWorkspace> {
    return this.prisma.membership.create({
      data: {
        role: 'OWNER',
        user: { connect: { id: ownerId } },
        workspace: { create: { name } },
      },
      include: { workspace: true },
    });
  }

  /** Every workspace the user belongs to, with their role. Filtered by userId. */
  findAllForUser(userId: string): Promise<MembershipWithWorkspace[]> {
    return this.prisma.membership.findMany({
      where: { userId },
      include: { workspace: true },
      orderBy: { workspace: { name: 'asc' } },
    });
  }

  findById(workspaceId: string): Promise<Workspace | null> {
    return this.prisma.workspace.findUnique({ where: { id: workspaceId } });
  }

  rename(workspaceId: string, name: string): Promise<Workspace> {
    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { name },
    });
  }

  /** Memberships (and later projects/tasks) are removed by ON DELETE CASCADE. */
  async delete(workspaceId: string): Promise<void> {
    await this.prisma.workspace.delete({ where: { id: workspaceId } });
  }
}
