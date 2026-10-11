import { redisOptionsFromUrl } from './redis-connection';

describe('redisOptionsFromUrl', () => {
  it('parses a plain local URL', () => {
    expect(redisOptionsFromUrl('redis://localhost:6379')).toEqual({
      host: 'localhost',
      port: 6379,
      username: undefined,
      password: undefined,
      db: 0,
    });
  });

  it('parses credentials, database and TLS', () => {
    expect(
      redisOptionsFromUrl('rediss://app:p%40ss@cache.example.com:6380/2'),
    ).toEqual({
      host: 'cache.example.com',
      port: 6380,
      username: 'app',
      password: 'p@ss',
      db: 2,
      tls: {},
    });
  });

  it('defaults the port', () => {
    expect(redisOptionsFromUrl('redis://cache').port).toBe(6379);
  });
});
