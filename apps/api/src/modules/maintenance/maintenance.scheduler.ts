import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  MAINTENANCE_CLEANUP_JOB,
  MAINTENANCE_QUEUE,
} from '../../queue/queue.constants';
import { QUEUE_CALL_TIMEOUT_MS, withTimeout } from '../../queue/with-timeout';

export const CLEANUP_EVERY_MS = 60 * 60 * 1000;

/**
 * Registers the hourly cleanup as a BullMQ job scheduler.
 * WHY in the queue instead of setInterval: Redis stores the schedule, so with several
 * API instances the job still runs once per hour (not once per instance), and a
 * crash mid-run is retried.
 */
@Injectable()
export class MaintenanceScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(MaintenanceScheduler.name);

  constructor(@InjectQueue(MAINTENANCE_QUEUE) private readonly queue: Queue) {}

  onApplicationBootstrap(): void {
    // Not awaited: an unavailable Redis must not block the API from starting.
    void this.schedule();
  }

  async schedule(): Promise<void> {
    try {
      await withTimeout(
        this.queue.upsertJobScheduler(
          'hourly-cleanup',
          { every: CLEANUP_EVERY_MS },
          { name: MAINTENANCE_CLEANUP_JOB },
        ),
        QUEUE_CALL_TIMEOUT_MS,
        'upsertJobScheduler',
      );
    } catch (error) {
      this.logger.warn(
        `Could not schedule maintenance: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
