import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AddMemberRequest,
  AssignableWorkspaceRole,
  canAssignRole,
  canManageMember,
  MemberDto,
} from '@teamflow/shared';
import {
  isRecordNotFound,
  isUniqueConstraintViolation,
} from '../../prisma/prisma-errors';
import { UsersService } from '../users/users.service';
import {
  MembershipsRepository,
  MembershipWithUser,
} from './memberships.repository';
import { WorkspaceMember } from './workspace-member';

function toMemberDto(membership: MembershipWithUser): MemberDto {
  return {
    userId: membership.user.id,
    name: membership.user.name,
    email: membership.user.email,
    role: membership.role,
    joinedAt: membership.createdAt.toISOString(),
  };
}

/**
 * Membership rules. The guard only checks a minimum role; the rules that depend on
 * WHO is being changed (rank comparisons, self-changes, the owner) live here, because
 * they are business logic, not routing.
 */
@Injectable()
export class MembersService {
  constructor(
    private readonly memberships: MembershipsRepository,
    private readonly users: UsersService,
  ) {}

  async list(actor: WorkspaceMember): Promise<MemberDto[]> {
    const memberships = await this.memberships.list(actor.workspaceId);
    return memberships.map(toMemberDto);
  }

  /**
   * Adds an existing user by email. (Email invitations for people without an account
   * arrive with the notifications queue in MVP step 8.)
   */
  async add(
    actor: WorkspaceMember,
    request: AddMemberRequest,
  ): Promise<MemberDto> {
    if (!canAssignRole(actor.role, request.role)) {
      throw new ForbiddenException(`You cannot grant the ${request.role} role`);
    }

    const user = await this.users.findByEmail(request.email);
    if (!user) {
      throw new NotFoundException('No TeamFlow account uses that email');
    }

    try {
      const membership = await this.memberships.create(
        actor.workspaceId,
        user.id,
        request.role,
      );
      return toMemberDto(membership);
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException('That user is already a member');
      }
      throw error;
    }
  }

  async changeRole(
    actor: WorkspaceMember,
    targetUserId: string,
    role: AssignableWorkspaceRole,
  ): Promise<MemberDto> {
    if (targetUserId === actor.userId) {
      // Prevents an ADMIN from "promoting" themselves and makes accidental
      // self-demotion impossible.
      throw new ForbiddenException('You cannot change your own role');
    }

    const target = await this.findTarget(actor, targetUserId);
    if (
      !canManageMember(actor.role, target.role) ||
      !canAssignRole(actor.role, role)
    ) {
      throw new ForbiddenException('Your role does not allow this change');
    }

    const updated = await this.orNotFound(
      this.memberships.updateRole(actor.workspaceId, targetUserId, role),
    );
    return toMemberDto(updated);
  }

  /** Removing yourself means leaving. The owner cannot leave (delete the workspace instead). */
  async remove(actor: WorkspaceMember, targetUserId: string): Promise<void> {
    if (targetUserId === actor.userId) {
      if (actor.role === 'OWNER') {
        throw new ForbiddenException(
          'The owner cannot leave the workspace. Delete it instead.',
        );
      }
      await this.orNotFound(
        this.memberships.delete(actor.workspaceId, actor.userId),
      );
      return;
    }

    const target = await this.findTarget(actor, targetUserId);
    if (!canManageMember(actor.role, target.role)) {
      throw new ForbiddenException(
        'Your role does not allow removing this member',
      );
    }
    await this.orNotFound(
      this.memberships.delete(actor.workspaceId, targetUserId),
    );
  }

  private async findTarget(actor: WorkspaceMember, userId: string) {
    const target = await this.memberships.find(actor.workspaceId, userId);
    if (!target) {
      throw new NotFoundException('Member not found');
    }
    return target;
  }

  /** The member vanished between our check and our write (concurrent removal). */
  private async orNotFound<T>(write: Promise<T>): Promise<T> {
    try {
      return await write;
    } catch (error) {
      if (isRecordNotFound(error)) {
        throw new NotFoundException('Member not found');
      }
      throw error;
    }
  }
}
