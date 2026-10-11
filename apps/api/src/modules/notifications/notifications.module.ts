import { Module } from '@nestjs/common';
import { NotificationsListener } from './notifications.listener';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsRepository } from './notifications.repository';

/**
 * Producer (listener) and consumer (processor) live in the same app for now.
 * The processor could move to a separate worker process later without code changes
 * elsewhere, because they only share the Redis queue.
 */
@Module({
  providers: [
    NotificationsListener,
    NotificationsProcessor,
    NotificationsRepository,
  ],
})
export class NotificationsModule {}
