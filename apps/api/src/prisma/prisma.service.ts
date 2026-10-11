import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { EnvironmentVariables } from '../config/env.validation';
import { PrismaClient } from '../generated/prisma/client';

/**
 * The single Prisma client for the whole API, shared through Nest's DI container.
 *
 * WHY one instance: each client owns a connection pool. Creating clients per request
 * or per module would exhaust Postgres connections. Prisma connects lazily on the
 * first query, so the API can boot even before the database is up.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get('DATABASE_URL', { infer: true }),
      }),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
