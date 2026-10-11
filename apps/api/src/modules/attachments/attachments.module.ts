import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsRepository } from './attachments.repository';
import { AttachmentsService } from './attachments.service';

@Module({
  imports: [WorkspacesModule, TasksModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, AttachmentsRepository],
  // The maintenance job (step 8) cleans up abandoned uploads through the repository.
  exports: [AttachmentsRepository],
})
export class AttachmentsModule {}
