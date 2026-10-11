import { Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { StorageService } from '../../storage/storage.service';
import { AttachmentsRepository } from '../attachments/attachments.repository';
import { RefreshTokenRepository } from '../auth/refresh-token.repository';
import {
  MaintenanceProcessor,
  STALE_UPLOAD_AGE_MS,
} from './maintenance.processor';
import {
  CLEANUP_EVERY_MS,
  MaintenanceScheduler,
} from './maintenance.scheduler';

describe('MaintenanceProcessor', () => {
  const now = new Date('2026-10-11T12:00:00.000Z');
  let refreshTokens: { deleteExpired: jest.Mock };
  let attachments: { findStalePending: jest.Mock; deleteMany: jest.Mock };
  let storage: { delete: jest.Mock };
  let processor: MaintenanceProcessor;

  beforeEach(() => {
    refreshTokens = { deleteExpired: jest.fn().mockResolvedValue(3) };
    attachments = {
      findStalePending: jest.fn().mockResolvedValue([
        { id: 'a-1', storageKey: 'k-1' },
        { id: 'a-2', storageKey: 'k-2' },
      ]),
      deleteMany: jest.fn(),
    };
    storage = { delete: jest.fn().mockResolvedValue(undefined) };
    processor = new MaintenanceProcessor(
      refreshTokens as unknown as RefreshTokenRepository,
      attachments as unknown as AttachmentsRepository,
      storage as unknown as StorageService,
    );
  });

  it('deletes expired refresh tokens and abandoned uploads', async () => {
    const result = await processor.cleanup(now);

    expect(refreshTokens.deleteExpired).toHaveBeenCalledWith(now);
    expect(attachments.findStalePending).toHaveBeenCalledWith(
      new Date(now.getTime() - STALE_UPLOAD_AGE_MS),
      500,
    );
    expect(storage.delete).toHaveBeenCalledWith('k-1');
    expect(storage.delete).toHaveBeenCalledWith('k-2');
    expect(attachments.deleteMany).toHaveBeenCalledWith(['a-1', 'a-2']);
    expect(result).toEqual({ expiredRefreshTokens: 3, staleUploads: 2 });
  });

  it('removes rows even when the object was never uploaded', async () => {
    storage.delete.mockRejectedValue(new Error('NoSuchKey'));

    await processor.cleanup(now);

    expect(attachments.deleteMany).toHaveBeenCalledWith(['a-1', 'a-2']);
  });

  it('skips the delete query when nothing is stale', async () => {
    attachments.findStalePending.mockResolvedValue([]);

    await processor.cleanup(now);

    expect(attachments.deleteMany).not.toHaveBeenCalled();
  });
});

describe('MaintenanceScheduler', () => {
  it('registers an hourly cleanup scheduler', async () => {
    const queue = { upsertJobScheduler: jest.fn().mockResolvedValue({}) };
    const scheduler = new MaintenanceScheduler(queue as unknown as Queue);

    await scheduler.schedule();

    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'hourly-cleanup',
      { every: CLEANUP_EVERY_MS },
      { name: 'cleanup' },
    );
  });

  it('does not throw when Redis is unavailable', async () => {
    const queue = {
      upsertJobScheduler: jest.fn().mockRejectedValue(new Error('offline')),
    };
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    await expect(
      new MaintenanceScheduler(queue as unknown as Queue).schedule(),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
