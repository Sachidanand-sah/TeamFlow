import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateProjectRequest,
  ProjectDto,
  UpdateProjectRequest,
} from '@teamflow/shared';
import { Project } from '../../generated/prisma/client';
import {
  isUniqueConstraintViolation,
  orNotFound,
} from '../../prisma/prisma-errors';
import { WorkspaceMember } from '../workspaces/workspace-member';
import { ProjectsRepository, UpdateProjectData } from './projects.repository';

const PROJECT_NOT_FOUND = 'Project not found';

function toProjectDto(project: Project): ProjectDto {
  return {
    id: project.id,
    workspaceId: project.workspaceId,
    key: project.key,
    name: project.name,
    description: project.description,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

/** Blank descriptions are stored as NULL, so "no description" has one representation. */
function normalizeDescription(
  description: string | null | undefined,
): string | null {
  const trimmed = description?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Role checks (VIEWER may read, ADMIN may write) happen in WorkspaceRoleGuard.
 * This service always scopes by `member.workspaceId`, which the guard verified.
 */
@Injectable()
export class ProjectsService {
  constructor(private readonly projects: ProjectsRepository) {}

  async list(member: WorkspaceMember): Promise<ProjectDto[]> {
    const projects = await this.projects.list(member.workspaceId);
    return projects.map(toProjectDto);
  }

  async get(member: WorkspaceMember, projectId: string): Promise<ProjectDto> {
    const project = await this.projects.find(member.workspaceId, projectId);
    if (!project) {
      throw new NotFoundException(PROJECT_NOT_FOUND);
    }
    return toProjectDto(project);
  }

  async create(
    member: WorkspaceMember,
    request: CreateProjectRequest,
  ): Promise<ProjectDto> {
    try {
      const project = await this.projects.create(member.workspaceId, {
        key: request.key,
        name: request.name.trim(),
        description: normalizeDescription(request.description),
      });
      return toProjectDto(project);
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException(
          `A project with key ${request.key} already exists in this workspace`,
        );
      }
      throw error;
    }
  }

  async update(
    member: WorkspaceMember,
    projectId: string,
    request: UpdateProjectRequest,
  ): Promise<ProjectDto> {
    // Only copy fields the client actually sent: `undefined` means "leave as is",
    // `null` (description only) means "clear".
    const data: UpdateProjectData = {};
    if (request.name !== undefined) {
      data.name = request.name.trim();
    }
    if (request.description !== undefined) {
      data.description = normalizeDescription(request.description);
    }

    const project = await orNotFound(
      this.projects.update(member.workspaceId, projectId, data),
      PROJECT_NOT_FOUND,
    );
    return toProjectDto(project);
  }

  delete(member: WorkspaceMember, projectId: string): Promise<void> {
    return orNotFound(
      this.projects.delete(member.workspaceId, projectId),
      PROJECT_NOT_FOUND,
    );
  }
}
