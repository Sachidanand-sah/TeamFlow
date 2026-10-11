import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
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

  /** true when a reverse proxy (e.g. Render) sits in front; see main.ts. */
  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  @IsBoolean()
  TRUST_PROXY = false;

  /** true in production: the API also serves the built Angular app (one origin). */
  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  @IsBoolean()
  SERVE_WEB_APP = false;

  /** Exact origin of the web app; CORS allows only this one. */
  @IsUrl({ require_tld: false, require_protocol: true })
  CORS_ORIGIN = 'http://localhost:4200';

  // --- Object storage (S3 API; MinIO locally) ---

  /** Must be reachable by BROWSERS too: they upload/download with signed URLs. */
  @IsUrl({ require_tld: false, require_protocol: true })
  S3_ENDPOINT = 'http://localhost:9000';

  @IsString()
  @MinLength(1)
  S3_REGION = 'us-east-1';

  @IsString()
  @MinLength(3)
  S3_BUCKET = 'teamflow-attachments';

  @IsString()
  @MinLength(3)
  S3_ACCESS_KEY!: string;

  @IsString()
  @MinLength(8)
  S3_SECRET_KEY!: string;

  // --- Queues and email ---

  @IsUrl({
    require_tld: false,
    protocols: ['redis', 'rediss'],
    require_protocol: true,
  })
  REDIS_URL = 'redis://localhost:6379';

  @IsString()
  @MinLength(1)
  SMTP_HOST = 'localhost';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  SMTP_PORT = 1025;

  /** true = TLS from the first byte (port 465). false = plain or STARTTLS. */
  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  @IsBoolean()
  SMTP_SECURE = false;

  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @IsOptional()
  @IsString()
  SMTP_PASSWORD?: string;

  @IsString()
  @MinLength(3)
  MAIL_FROM = 'TeamFlow <no-reply@teamflow.local>';

  /** Public URL of the web app, used for links in emails. */
  @IsUrl({ require_tld: false, require_protocol: true })
  APP_URL = 'http://localhost:4200';
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
