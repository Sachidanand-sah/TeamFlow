import type { RedisOptions } from 'ioredis';

/**
 * Turns "redis://user:pass@host:6379/2" (or rediss:// for TLS) into ioredis options.
 * One URL in the environment is easier to manage than five separate variables.
 */
export function redisOptionsFromUrl(url: string): RedisOptions {
  const parsed = new URL(url);
  const db = parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : 0;
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: Number.isInteger(db) ? db : 0,
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}
