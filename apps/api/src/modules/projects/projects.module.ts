import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ProjectsController } from './projects.controller';
import { ProjectsRepository } from './projects.repository';
import { ProjectsService } from './projects.service';

@Module({
  // WorkspacesModule exports WorkspaceRoleGuard and the repository it needs.
  imports: [WorkspacesModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectsRepository],
  // Tasks (step 4) will look projects up through the service.
  exports: [ProjectsService],
})
export class ProjectsModule {}
