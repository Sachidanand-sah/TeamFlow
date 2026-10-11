import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { ProjectsModule } from '../projects/projects.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { TasksController } from './tasks.controller';
import { TasksRepository } from './tasks.repository';
import { TasksService } from './tasks.service';

@Module({
  imports: [WorkspacesModule, ProjectsModule, ActivityModule],
  controllers: [TasksController],
  providers: [TasksService, TasksRepository],
  // Comments check that their task exists through TasksService.
  exports: [TasksService],
})
export class TasksModule {}
