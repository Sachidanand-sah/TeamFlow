import { NodeEnv, validateEnv } from './env.validation';

const validEnv = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('applies defaults for optional variables', () => {
    const env = validateEnv(validEnv);

    expect(env.NODE_ENV).toBe(NodeEnv.Development);
    expect(env.PORT).toBe(3000);
    expect(env.JWT_ACCESS_TTL_SECONDS).toBe(900);
    expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(7);
    expect(env.CORS_ORIGIN).toBe('http://localhost:4200');
  });

  it('converts numeric strings from process.env to numbers', () => {
    const env = validateEnv({ ...validEnv, PORT: '8080' });

    expect(env.PORT).toBe(8080);
  });

  it('rejects a JWT secret shorter than 32 characters', () => {
    expect(() =>
      validateEnv({ ...validEnv, JWT_ACCESS_SECRET: 'too-short' }),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() =>
      validateEnv({ JWT_ACCESS_SECRET: validEnv.JWT_ACCESS_SECRET }),
    ).toThrow(/DATABASE_URL/);
  });

  it('rejects an access token TTL longer than one hour', () => {
    expect(() =>
      validateEnv({ ...validEnv, JWT_ACCESS_TTL_SECONDS: '86400' }),
    ).toThrow(/JWT_ACCESS_TTL_SECONDS/);
  });
});
