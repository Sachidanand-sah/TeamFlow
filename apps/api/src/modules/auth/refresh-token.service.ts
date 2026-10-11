import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { EnvironmentVariables } from '../../config/env.validation';
import { IssuedRefreshToken } from './auth.types';
import { RefreshTokenRepository } from './refresh-token.repository';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RotatedRefreshToken {
  userId: string;
  refreshToken: IssuedRefreshToken;
}

/**
 * Issues, rotates and revokes refresh tokens (see docs/adr/0002).
 *
 * The raw token is 32 random bytes. Only its SHA-256 hash is stored.
 * WHY SHA-256 and not argon2 here: argon2 exists to slow down guessing of
 * *low-entropy* human passwords. A 256-bit random token cannot be guessed, so a fast
 * hash is enough to make a database leak useless, and it lets us look tokens up by
 * hash with a unique index.
 */
@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    private readonly tokens: RefreshTokenRepository,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  static hash(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  /** Starts a new token family (login/register) or continues one (rotation). */
  async issue(
    userId: string,
    familyId: string = randomUUID(),
  ): Promise<IssuedRefreshToken> {
    const { token, data } = this.generate(userId, familyId);
    await this.tokens.create(data);
    return { token, expiresAt: data.expiresAt };
  }

  /**
   * Exchanges a valid refresh token for a new one. The old token becomes unusable.
   *
   * WHY rotate + reuse detection: if an attacker steals a refresh token, either they
   * or the real user will present an already-used token. That is proof of theft, so
   * we revoke the whole family and both are forced to log in again.
   */
  async rotate(rawToken: string): Promise<RotatedRefreshToken> {
    const current = await this.tokens.findByHash(
      RefreshTokenService.hash(rawToken),
    );

    if (!current) {
      throw this.invalid();
    }

    if (current.revokedAt) {
      await this.handleReuse(current.familyId, current.userId);
      throw this.invalid();
    }

    if (current.expiresAt.getTime() <= Date.now()) {
      throw this.invalid();
    }

    const { token, data } = this.generate(current.userId, current.familyId);
    const created = await this.tokens.rotate(current.id, data);

    if (!created) {
      // Someone consumed this token between our read and our write: same as reuse.
      await this.handleReuse(current.familyId, current.userId);
      throw this.invalid();
    }

    return {
      userId: current.userId,
      refreshToken: { token, expiresAt: data.expiresAt },
    };
  }

  /** Logout: revokes the token's whole family. Unknown tokens are ignored (idempotent). */
  async revoke(rawToken: string): Promise<void> {
    const current = await this.tokens.findByHash(
      RefreshTokenService.hash(rawToken),
    );
    if (current) {
      await this.tokens.revokeFamily(current.familyId);
    }
  }

  private generate(userId: string, familyId: string) {
    const token = randomBytes(32).toString('base64url');
    const ttlDays = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
    return {
      token,
      data: {
        familyId,
        userId,
        tokenHash: RefreshTokenService.hash(token),
        expiresAt: new Date(Date.now() + ttlDays * DAY_MS),
      },
    };
  }

  private async handleReuse(familyId: string, userId: string): Promise<void> {
    this.logger.warn(
      `Refresh token reuse detected for user ${userId}; revoking family ${familyId}`,
    );
    await this.tokens.revokeFamily(familyId);
  }

  /** One generic error for every failure, so responses reveal nothing about why. */
  private invalid(): UnauthorizedException {
    return new UnauthorizedException('Invalid refresh token');
  }
}
