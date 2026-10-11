import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Every environment variable the API reads, with its type and constraints.
 *
 * WHY: validating config at startup turns a missing or weak secret into a crash on
 * boot ("fail fast"), instead of a confusing bug or a security hole at runtime.
 * Read values with `ConfigService<EnvironmentVariables, true>` so they are typed.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  API_PORT = 3000;

  @IsString()
  @MinLength(1)
  DATABASE_URL!: string;

  /** HMAC key for access tokens. 32+ chars so it cannot be brute-forced offline. */
  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET!: string;

  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(3600)
  JWT_ACCESS_TTL_SECONDS = 900;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  REFRESH_TOKEN_TTL_DAYS = 7;

  /** Exact origin of the web app; CORS allows only this one. */
  @IsUrl({ require_tld: false, require_protocol: true })
  CORS_ORIGIN = 'http://localhost:4200';
}

/** Used by `ConfigModule.forRoot({ validate })`. Throws if anything is invalid. */
export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config);
  const errors = validateSync(env);

  if (errors.length > 0) {
    const details = errors
      .map(
        (e) =>
          `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
      )
      .join('\n  ');
    throw new Error(`Invalid environment configuration:\n  ${details}`);
  }

  return env;
}
