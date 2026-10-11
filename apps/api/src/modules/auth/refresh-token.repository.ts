import { Injectable } from '@nestjs/common';
import { RefreshToken } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateRefreshTokenData {
  familyId: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateRefreshTokenData): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  findByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  /**
   * Marks `currentId` as used and stores its successor, atomically.
   * Returns null if `currentId` was already used/revoked.
   *
   * WHY `updateMany ... where revokedAt IS NULL`: it is a compare-and-set. If two
   * requests rotate the same token at the same moment, Postgres lets exactly one
   * update match; the other sees count 0 and is treated as token reuse.
   * WHY a transaction: we never want "old token consumed, new one not saved".
   */
  rotate(
    currentId: string,
    next: CreateRefreshTokenData,
  ): Promise<RefreshToken | null> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.refreshToken.updateMany({
        where: { id: currentId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (count === 0) {
        return null;
      }
      return tx.refreshToken.create({ data: next });
    });
  }

  /** Revokes every still-active token in the family (logout, or reuse detected). */
  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
