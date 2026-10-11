import { Module } from '@nestjs/common';
import { AttachmentsModule } from '../attachments/attachments.module';
import { AuthModule } from '../auth/auth.module';
import { MaintenanceProcessor } from './maintenance.processor';
import { MaintenanceScheduler } from './maintenance.scheduler';

@Module({
  imports: [AuthModule, AttachmentsModule],
  providers: [MaintenanceScheduler, MaintenanceProcessor],
})
export class MaintenanceModule {}
