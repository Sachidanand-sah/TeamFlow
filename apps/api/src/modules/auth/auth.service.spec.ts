import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EnvironmentVariables } from '../../config/env.validation';
import { User } from '../../generated/prisma/client';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { PasswordHasher } from './password-hasher';
import { RefreshTokenService } from './refresh-token.service';

const user: User = {
  id: 'user-1',
  email: 'ann@example.com',
  name: 'Ann',
  passwordHash: 'stored-hash',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const issued = {
  token: 'new-refresh',
  expiresAt: new Date('2026-10-18T00:00:00.000Z'),
};

describe('AuthService', () => {
  let users: jest.Mocked<
    Pick<UsersService, 'create' | 'findByEmail' | 'findById'>
  >;
  let hasher: jest.Mocked<
    Pick<PasswordHasher, 'hash' | 'verify' | 'verifyDummy'>
  >;
  let refreshTokens: jest.Mocked<
    Pick<RefreshTokenService, 'issue' | 'rotate' | 'revoke'>
  >;
  let jwt: jest.Mocked<Pick<JwtService, 'signAsync'>>;
  let service: AuthService;

  beforeEach(() => {
    users = { create: jest.fn(), findByEmail: jest.fn(), findById: jest.fn() };
    hasher = { hash: jest.fn(), verify: jest.fn(), verifyDummy: jest.fn() };
    refreshTokens = { issue: jest.fn(), rotate: jest.fn(), revoke: jest.fn() };
    jwt = { signAsync: jest.fn().mockResolvedValue('access-jwt') };
    const config = {
      get: jest.fn().mockReturnValue(900),
    } as unknown as ConfigService<EnvironmentVariables, true>;

    service = new AuthService(
      users as unknown as UsersService,
      hasher as unknown as PasswordHasher,
      refreshTokens as unknown as RefreshTokenService,
      jwt as unknown as JwtService,
      config,
    );
  });

  describe('register', () => {
    it('hashes the password, creates the user and starts a session', async () => {
      hasher.hash.mockResolvedValue('argon-hash');
      users.create.mockResolvedValue(user);
      refreshTokens.issue.mockResolvedValue(issued);

      const result = await service.register({
        email: 'ann@example.com',
        name: 'Ann',
        password: 'a-long-password',
      });

      expect(hasher.hash).toHaveBeenCalledWith('a-long-password');
      expect(users.create).toHaveBeenCalledWith({
        email: 'ann@example.com',
        name: 'Ann',
        passwordHash: 'argon-hash',
      });
      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: 'user-1',
        email: 'ann@example.com',
      });
      expect(refreshTokens.issue).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({
        response: {
          accessToken: 'access-jwt',
          expiresIn: 900,
          user: {
            id: 'user-1',
            email: 'ann@example.com',
            name: 'Ann',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        },
        refreshToken: issued,
      });
    });

    it('never passes the plain password to the users service', async () => {
      hasher.hash.mockResolvedValue('argon-hash');
      users.create.mockResolvedValue(user);
      refreshTokens.issue.mockResolvedValue(issued);

      await service.register({
        email: 'a@b.co',
        name: 'A',
        password: 'plain-secret-pw',
      });

      expect(JSON.stringify(users.create.mock.calls)).not.toContain(
        'plain-secret-pw',
      );
    });
  });

  describe('login', () => {
    it('starts a session for valid credentials', async () => {
      users.findByEmail.mockResolvedValue(user);
      hasher.verify.mockResolvedValue(true);
      refreshTokens.issue.mockResolvedValue(issued);

      const result = await service.login({
        email: 'ann@example.com',
        password: 'pw',
      });

      expect(hasher.verify).toHaveBeenCalledWith('stored-hash', 'pw');
      expect(result.response.accessToken).toBe('access-jwt');
      expect(result.refreshToken).toBe(issued);
    });

    it('rejects a wrong password with a generic message', async () => {
      users.findByEmail.mockResolvedValue(user);
      hasher.verify.mockResolvedValue(false);

      await expect(
        service.login({ email: 'ann@example.com', password: 'wrong' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
      expect(refreshTokens.issue).not.toHaveBeenCalled();
    });

    it('rejects an unknown email with the same message, after equal-time hashing', async () => {
      users.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'pw' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
      expect(hasher.verifyDummy).toHaveBeenCalledWith('pw');
      expect(refreshTokens.issue).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('rotates the token and returns a new access token', async () => {
      refreshTokens.rotate.mockResolvedValue({
        userId: 'user-1',
        refreshToken: issued,
      });
      users.findById.mockResolvedValue(user);

      const result = await service.refresh('old-refresh');

      expect(refreshTokens.rotate).toHaveBeenCalledWith('old-refresh');
      expect(result.response.accessToken).toBe('access-jwt');
      expect(result.refreshToken).toBe(issued);
    });

    it('rejects a request without a refresh cookie', async () => {
      await expect(service.refresh(undefined)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshTokens.rotate).not.toHaveBeenCalled();
    });

    it('rejects when the user no longer exists', async () => {
      refreshTokens.rotate.mockResolvedValue({
        userId: 'gone',
        refreshToken: issued,
      });
      users.findById.mockResolvedValue(null);

      await expect(service.refresh('old-refresh')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('propagates rotation failures (e.g. reuse detected)', async () => {
      refreshTokens.rotate.mockRejectedValue(new UnauthorizedException());

      await expect(service.refresh('reused')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('revokes the presented refresh token', async () => {
      await service.logout('current-refresh');

      expect(refreshTokens.revoke).toHaveBeenCalledWith('current-refresh');
    });

    it('is a no-op without a refresh cookie', async () => {
      await service.logout(undefined);

      expect(refreshTokens.revoke).not.toHaveBeenCalled();
    });
  });
});
