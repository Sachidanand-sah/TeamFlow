import { defineConfig } from 'prisma/config';

// Prisma 7 no longer reads .env by itself. Node >= 20.12 can load it natively,
// so we avoid a dotenv dependency. A missing .env is fine (e.g. in CI, where
// variables come from the environment).
try {
  process.loadEnvFile();
} catch {
  // no .env file
}

export default defineConfig({
  schema: 'apps/api/prisma/schema.prisma',
  migrations: {
    path: 'apps/api/prisma/migrations',
  },
  datasource: {
    // The CLI (migrations) prefers a DIRECT connection: hosted Postgres such as Neon
    // hands the app a pooled URL (PgBouncer), and schema changes should not go
    // through a transaction pooler. The running app always uses DATABASE_URL.
    url: process.env['DIRECT_URL'] || process.env['DATABASE_URL'],
  },
});
