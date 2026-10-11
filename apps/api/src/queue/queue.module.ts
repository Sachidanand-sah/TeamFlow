import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation';
import { MAINTENANCE_QUEUE, NOTIFICATIONS_QUEUE } from './queue.constants';
import { redisOptionsFromUrl } from './redis-connection';

type Config = ConfigService<EnvironmentVariables, true>;

/**
 * BullMQ on Redis.
 *
 * Two connection profiles, on purpose:
 * - Workers (processors) use `maxRetriesPerRequest: null`: BullMQ requires it, so a
 *   worker waits for Redis to come back instead of crashing.
 * - Producers (queues used inside HTTP requests) use `enableOfflineQueue: false`:
 *   if Redis is down, `queue.add()` fails fast instead of hanging the request.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: Config) => ({
        connection: {
          ...redisOptionsFromUrl(config.get('REDIS_URL', { infer: true })),
          maxRetriesPerRequest: null,
        },
      }),
    }),
    ...[NOTIFICATIONS_QUEUE, MAINTENANCE_QUEUE].map((name) =>
      BullModule.registerQueueAsync({
        name,
        inject: [ConfigService],
        useFactory: (config: Config) => ({
          connection: {
            ...redisOptionsFromUrl(config.get('REDIS_URL', { infer: true })),
            enableOfflineQueue: false,
          },
          defaultJobOptions: {
            // Transient failures (SMTP hiccup, Redis blip) are retried with growing gaps.
            attempts: 5,
            backoff: { type: 'exponential', delay: 10_000 },
            // Keep some history for debugging, but never grow Redis without bound.
            removeOnComplete: 1000,
            removeOnFail: 5000,
          },
        }),
      }),
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
