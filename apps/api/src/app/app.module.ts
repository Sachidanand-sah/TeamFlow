import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from '../config/env.validation';
import { DomainEventsModule } from '../events/domain-events';
import { ActivityModule } from '../modules/activity/activity.module';
import { AttachmentsModule } from '../modules/attachments/attachments.module';
import { AuthModule } from '../modules/auth/auth.module';
import { CommentsModule } from '../modules/comments/comments.module';
import { ProjectsModule } from '../modules/projects/projects.module';
import { RealtimeModule } from '../modules/realtime/realtime.module';
import { TasksModule } from '../modules/tasks/tasks.module';
import { UsersModule } from '../modules/users/users.module';
import { WorkspacesModule } from '../modules/workspaces/workspaces.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    // Default: 100 requests per minute per IP. Credential endpoints use a lower limit.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    DomainEventsModule,
    UsersModule,
    AuthModule,
    WorkspacesModule,
    ProjectsModule,
    TasksModule,
    ActivityModule,
    CommentsModule,
    RealtimeModule,
    StorageModule,
    AttachmentsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
