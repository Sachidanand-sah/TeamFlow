import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RefreshToken } from '../../generated/prisma/client';
import { EnvironmentVariables } from '../../config/env.validation';
import { RefreshTokenRepository } from './refresh-token.repository';
import { RefreshTokenService } from './refresh-token.service';

const NOW = new Date('2026-10-11T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function storedToken(overrides: Partial<RefreshToken> = {}): RefreshToken {
  return {
    id: 'token-1',
    familyId: 'family-1',
    userId: 'user-1',
    tokenHash: RefreshTokenService.hash('raw-token'),
    expiresAt: new Date(NOW.getTime() + DAY_MS),
    revokedAt: null,
    createdAt: NOW,
    ...overrides,
  };
}

describe('RefreshTokenService', () => {
  let repo: jest.Mocked<
    Pick<
      RefreshTokenRepository,
      'create' | 'findByHash' | 'rotate' | 'revokeFamily'
    >
  >;
  let service: RefreshTokenService;

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    repo = {
      create: jest.fn(),
      findByHash: jest.fn(),
      rotate: jest.fn(),
      revokeFamily: jest.fn(),
    };
    const config = {
      get: jest.fn().mockReturnValue(7),
    } as unknown as ConfigService<EnvironmentVariables, true>;
    service = new RefreshTokenService(
      repo as unknown as RefreshTokenRepository,
      config,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('hash', () => {
    it('is deterministic SHA-256 hex', () => {
      expect(RefreshTokenService.hash('abc')).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );
    });
  });

  describe('issue', () => {
    it('stores only the hash of a random token, expiring after the TTL', async () => {
      const issued = await service.issue('user-1', 'family-1');

      expect(issued.token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 bytes, base64url
      expect(issued.expiresAt).toEqual(new Date(NOW.getTime() + 7 * DAY_MS));
      expect(repo.create).toHaveBeenCalledWith({
        familyId: 'family-1',
        userId: 'user-1',
        tokenHash: RefreshTokenService.hash(issued.token),
        expiresAt: issued.expiresAt,
      });
    });

    it('starts a new family when none is given', async () => {
      await service.issue('user-1');

      const familyId = repo.create.mock.calls[0][0].familyId;
      expect(familyId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('generates a different token every time', async () => {
      const a = await service.issue('user-1');
      const b = await service.issue('user-1');

      expect(a.token).not.toBe(b.token);
    });
  });

  describe('rotate', () => {
    it('consumes the current token and issues a successor in the same family', async () => {
      repo.findByHash.mockResolvedValue(storedToken());
      repo.rotate.mockResolvedValue(storedToken({ id: 'token-2' }));

      const result = await service.rotate('raw-token');

      expect(repo.findByHash).toHaveBeenCalledWith(
        RefreshTokenService.hash('raw-token'),
      );
      expect(result.userId).toBe('user-1');
      expect(result.refreshToken.token).not.toBe('raw-token');
      expect(repo.rotate).toHaveBeenCalledWith('token-1', {
        familyId: 'family-1',
        userId: 'user-1',
        tokenHash: RefreshTokenService.hash(result.refreshToken.token),
        expiresAt: result.refreshToken.expiresAt,
      });
      expect(repo.revokeFamily).not.toHaveBeenCalled();
    });

    it('rejects an unknown token', async () => {
      repo.findByHash.mockResolvedValue(null);

      await expect(service.rotate('unknown')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(repo.rotate).not.toHaveBeenCalled();
    });

    it('revokes the whole family when an already-used token is presented', async () => {
      repo.findByHash.mockResolvedValue(storedToken({ revokedAt: NOW }));

      await expect(service.rotate('raw-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(repo.revokeFamily).toHaveBeenCalledWith('family-1');
      expect(repo.rotate).not.toHaveBeenCalled();
    });

    it('rejects an expired token without revoking the family', async () => {
      repo.findByHash.mockResolvedValue(storedToken({ expiresAt: NOW }));

      await expect(service.rotate('raw-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(repo.rotate).not.toHaveBeenCalled();
      expect(repo.revokeFamily).not.toHaveBeenCalled();
    });

    it('treats losing a concurrent rotation race as reuse', async () => {
      repo.findByHash.mockResolvedValue(storedToken());
      repo.rotate.mockResolvedValue(null);

      await expect(service.rotate('raw-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(repo.revokeFamily).toHaveBeenCalledWith('family-1');
    });
  });

  describe('revoke', () => {
    it('revokes the family of a known token', async () => {
      repo.findByHash.mockResolvedValue(storedToken());

      await service.revoke('raw-token');

      expect(repo.revokeFamily).toHaveBeenCalledWith('family-1');
    });

    it('does nothing for an unknown token', async () => {
      repo.findByHash.mockResolvedValue(null);

      await service.revoke('unknown');

      expect(repo.revokeFamily).not.toHaveBeenCalled();
    });
  });
});
