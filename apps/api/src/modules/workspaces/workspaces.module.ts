import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { WorkspaceRoleGuard } from './guards/workspace-role.guard';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { MembershipsRepository } from './memberships.repository';
import {
  WorkspaceController,
  WorkspacesController,
} from './workspaces.controller';
import { WorkspacesRepository } from './workspaces.repository';
import { WorkspacesService } from './workspaces.service';

@Module({
  imports: [UsersModule],
  controllers: [WorkspacesController, WorkspaceController, MembersController],
  providers: [
    WorkspacesService,
    MembersService,
    WorkspacesRepository,
    MembershipsRepository,
    WorkspaceRoleGuard,
  ],
  // Projects/tasks modules will protect their routes with the same guard.
  exports: [WorkspaceRoleGuard, MembershipsRepository],
})
export class WorkspacesModule {}
