import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthResponse, LoginRequest, RegisterRequest } from '@teamflow/shared';
import { EnvironmentVariables } from '../../config/env.validation';
import { User } from '../../generated/prisma/client';
import { toUserDto, UsersService } from '../users/users.service';
import { AccessTokenPayload, IssuedRefreshToken } from './auth.types';
import { PasswordHasher } from './password-hasher';
import { RefreshTokenService } from './refresh-token.service';

/** What the controller needs: a body for the client and a token for the cookie. */
export interface AuthResult {
  response: AuthResponse;
  refreshToken: IssuedRefreshToken;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly hasher: PasswordHasher,
    private readonly refreshTokens: RefreshTokenService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async register(request: RegisterRequest): Promise<AuthResult> {
    const passwordHash = await this.hasher.hash(request.password);
    const user = await this.users.create({
      email: request.email,
      name: request.name,
      passwordHash,
    });
    return this.startSession(user);
  }

  async login(request: LoginRequest): Promise<AuthResult> {
    const user = await this.users.findByEmail(request.email);

    if (!user) {
      await this.hasher.verifyDummy(request.password);
      throw this.invalidCredentials();
    }

    const valid = await this.hasher.verify(user.passwordHash, request.password);
    if (!valid) {
      throw this.invalidCredentials();
    }

    return this.startSession(user);
  }

  async refresh(rawRefreshToken: string | undefined): Promise<AuthResult> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const { userId, refreshToken } =
      await this.refreshTokens.rotate(rawRefreshToken);
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return { response: await this.buildResponse(user), refreshToken };
  }

  /** Idempotent: logging out twice, or with no cookie, is not an error. */
  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (rawRefreshToken) {
      await this.refreshTokens.revoke(rawRefreshToken);
    }
  }

  private async startSession(user: User): Promise<AuthResult> {
    const refreshToken = await this.refreshTokens.issue(user.id);
    return { response: await this.buildResponse(user), refreshToken };
  }

  private async buildResponse(user: User): Promise<AuthResponse> {
    const payload: AccessTokenPayload = { sub: user.id, email: user.email };
    return {
      accessToken: await this.jwt.signAsync(payload),
      expiresIn: this.config.get('JWT_ACCESS_TTL_SECONDS', { infer: true }),
      user: toUserDto(user),
    };
  }

  /**
   * Same message for "no such email" and "wrong password".
   * WHY: different messages would let anyone check whether an email has an account.
   */
  private invalidCredentials(): UnauthorizedException {
    return new UnauthorizedException('Invalid email or password');
  }
}
