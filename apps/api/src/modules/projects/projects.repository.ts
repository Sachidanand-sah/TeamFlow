import { Injectable } from '@nestjs/common';
import { Project } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateProjectData {
  key: string;
  name: string;
  description: string | null;
}

export interface UpdateProjectData {
  name?: string;
  description?: string | null;
}

/**
 * Every method takes `workspaceId` and puts it in the WHERE clause next to the id.
 *
 * WHY not just `where: { id: projectId }`: ids leak (URLs, logs, screenshots). If a
 * member of workspace A sends the id of a project in workspace B, the query must
 * match nothing. Filtering by both makes cross-tenant access impossible at the
 * data layer, even if a check above it is ever forgotten.
 */
@Injectable()
export class ProjectsRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(workspaceId: string): Promise<Project[]> {
    return this.prisma.project.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
    });
  }

  find(workspaceId: string, projectId: string): Promise<Project | null> {
    return this.prisma.project.findFirst({
      where: { id: projectId, workspaceId },
    });
  }

  create(workspaceId: string, data: CreateProjectData): Promise<Project> {
    return this.prisma.project.create({ data: { ...data, workspaceId } });
  }

  /** Throws Prisma P2025 if no project with this id exists IN THIS workspace. */
  update(
    workspaceId: string,
    projectId: string,
    data: UpdateProjectData,
  ): Promise<Project> {
    return this.prisma.project.update({
      where: { id: projectId, workspaceId },
      data,
    });
  }

  /** Throws Prisma P2025 if no project with this id exists IN THIS workspace. */
  async delete(workspaceId: string, projectId: string): Promise<void> {
    await this.prisma.project.delete({
      where: { id: projectId, workspaceId },
    });
  }
}
