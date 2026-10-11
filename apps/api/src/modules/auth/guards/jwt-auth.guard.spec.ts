import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedRequest } from '../auth.types';
import { extractBearerToken, JwtAuthGuard } from './jwt-auth.guard';

const SECRET = 'test-secret-that-is-at-least-32-chars';

function contextFor(request: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const jwt = new JwtService({
    secret: SECRET,
    signOptions: { expiresIn: 60 },
  });
  let reflector: Reflector;
  let guard: JwtAuthGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(jwt, reflector);
  });

  it('lets @Public() routes through without a token', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

    await expect(guard.canActivate(contextFor({ headers: {} }))).resolves.toBe(
      true,
    );
  });

  it('rejects a request without an Authorization header', async () => {
    await expect(
      guard.canActivate(contextFor({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts a valid token and attaches the user to the request', async () => {
    const token = await jwt.signAsync({
      sub: 'user-1',
      email: 'ann@example.com',
    });
    const request: Partial<AuthenticatedRequest> = {
      headers: { authorization: `Bearer ${token}` },
    };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'user-1', email: 'ann@example.com' });
  });

  it('rejects a token signed with a different secret', async () => {
    const forged = await new JwtService({
      secret: 'another-secret-another-secret-123',
    }).signAsync({ sub: 'user-1', email: 'ann@example.com' });

    await expect(
      guard.canActivate(
        contextFor({ headers: { authorization: `Bearer ${forged}` } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an expired token', async () => {
    const expired = await jwt.signAsync(
      { sub: 'user-1', email: 'ann@example.com' },
      { expiresIn: -10 },
    );

    await expect(
      guard.canActivate(
        contextFor({ headers: { authorization: `Bearer ${expired}` } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('extractBearerToken', () => {
  it.each([
    [undefined, null],
    ['', null],
    ['Basic abc', null],
    ['Bearer', null],
    ['Bearer abc.def.ghi', 'abc.def.ghi'],
  ])('%p -> %p', (header, expected) => {
    expect(extractBearerToken(header)).toBe(expected);
  });
});
