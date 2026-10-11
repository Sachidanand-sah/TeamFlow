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
    url: process.env['DATABASE_URL'],
  },
});
