/**
 * Auth API contracts shared by apps/api and apps/web.
 * Keep this file framework-free: no NestJS, Angular or class-validator imports.
 */

/** Password policy, shared so the Angular form validates exactly like the API. */
export const PASSWORD_MIN_LENGTH = 12;
/** Upper bound protects the server: hashing a multi-megabyte "password" is a cheap DoS. */
export const PASSWORD_MAX_LENGTH = 128;
export const NAME_MAX_LENGTH = 100;
/** RFC 5321 limit for an email address. */
export const EMAIL_MAX_LENGTH = 254;

/** Public view of a user. Never contains the password hash. */
export interface UserDto {
  id: string;
  email: string;
  name: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

export interface RegisterRequest {
  email: string;
  name: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Returned by register, login and refresh. The refresh token is NOT in the body:
 * it is set as an httpOnly cookie so JavaScript (and therefore XSS) cannot read it.
 */
export interface AuthResponse {
  accessToken: string;
  /** Access token lifetime in seconds. */
  expiresIn: number;
  user: UserDto;
}
