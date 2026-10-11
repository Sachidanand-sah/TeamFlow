import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { StorageService } from '../../storage/storage.service';
import { MAINTENANCE_QUEUE } from '../../queue/queue.constants';
import { AttachmentsRepository } from '../attachments/attachments.repository';
import { RefreshTokenRepository } from '../auth/refresh-token.repository';

const HOUR_MS = 60 * 60 * 1000;
/** Uploads not completed within this time are considered abandoned. */
export const STALE_UPLOAD_AGE_MS = 24 * HOUR_MS;
const STALE_UPLOAD_BATCH = 500;

export interface CleanupResult {
  expiredRefreshTokens: number;
  staleUploads: number;
}

/** Periodic housekeeping, run by the queue (see MaintenanceScheduler). */
@Processor(MAINTENANCE_QUEUE)
export class MaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly attachments: AttachmentsRepository,
    private readonly storage: StorageService,
  ) {
    super();
  }

  async process(): Promise<CleanupResult> {
    const result = await this.cleanup(new Date());
    this.logger.log(
      `Cleanup: ${result.expiredRefreshTokens} expired refresh tokens, ${result.staleUploads} abandoned uploads`,
    );
    return result;
  }

  async cleanup(now: Date): Promise<CleanupResult> {
    const expiredRefreshTokens = await this.refreshTokens.deleteExpired(now);

    const stale = await this.attachments.findStalePending(
      new Date(now.getTime() - STALE_UPLOAD_AGE_MS),
      STALE_UPLOAD_BATCH,
    );
    for (const upload of stale) {
      // The object may never have been uploaded; a failed delete is not fatal.
      await this.storage.delete(upload.storageKey).catch(() => undefined);
    }
    if (stale.length > 0) {
      await this.attachments.deleteMany(stale.map((s) => s.id));
    }

    return { expiredRefreshTokens, staleUploads: stale.length };
  }
}
