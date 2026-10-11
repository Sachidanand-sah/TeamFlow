import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkspaceDto, WorkspaceRole } from '@teamflow/shared';
import { Workspace } from '../../generated/prisma/client';
import { isRecordNotFound } from '../../prisma/prisma-errors';
import { WorkspaceMember } from './workspace-member';
import { WorkspacesRepository } from './workspaces.repository';

function toWorkspaceDto(
  workspace: Workspace,
  role: WorkspaceRole,
): WorkspaceDto {
  return {
    id: workspace.id,
    name: workspace.name,
    role,
    createdAt: workspace.createdAt.toISOString(),
  };
}

/**
 * Methods that act on one workspace take a `WorkspaceMember` (verified by the guard)
 * instead of a raw `workspaceId`. WHY: the type makes it impossible to call them with
 * an id that has not been checked against the caller's membership.
 */
@Injectable()
export class WorkspacesService {
  constructor(private readonly workspaces: WorkspacesRepository) {}

  /** The creator becomes OWNER. */
  async create(userId: string, name: string): Promise<WorkspaceDto> {
    const membership = await this.workspaces.createWithOwner(
      name.trim(),
      userId,
    );
    return toWorkspaceDto(membership.workspace, membership.role);
  }

  async listForUser(userId: string): Promise<WorkspaceDto[]> {
    const memberships = await this.workspaces.findAllForUser(userId);
    return memberships.map((m) => toWorkspaceDto(m.workspace, m.role));
  }

  async get(member: WorkspaceMember): Promise<WorkspaceDto> {
    const workspace = await this.workspaces.findById(member.workspaceId);
    if (!workspace) {
      // Deleted between the guard's check and this read.
      throw new NotFoundException('Workspace not found');
    }
    return toWorkspaceDto(workspace, member.role);
  }

  async rename(member: WorkspaceMember, name: string): Promise<WorkspaceDto> {
    const workspace = await orNotFound(
      this.workspaces.rename(member.workspaceId, name.trim()),
    );
    return toWorkspaceDto(workspace, member.role);
  }

  delete(member: WorkspaceMember): Promise<void> {
    return orNotFound(this.workspaces.delete(member.workspaceId));
  }
}

/** The workspace was deleted by someone else between the guard's check and the write. */
async function orNotFound<T>(write: Promise<T>): Promise<T> {
  try {
    return await write;
  } catch (error) {
    if (isRecordNotFound(error)) {
      throw new NotFoundException('Workspace not found');
    }
    throw error;
  }
}
