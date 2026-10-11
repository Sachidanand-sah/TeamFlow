import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserDto } from '@teamflow/shared';
import { User } from '../../generated/prisma/client';
import { isUniqueConstraintViolation } from '../../prisma/prisma-errors';
import { CreateUserData, UsersRepository } from './users.repository';

/**
 * Emails are case-insensitive in practice ("Ann@x.com" and "ann@x.com" are the same
 * inbox), so we store one canonical form. Otherwise one person could register twice.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Maps the database row to the public shape.
 * WHY an explicit mapper: returning the Prisma `User` directly would leak
 * `passwordHash` to the client the moment someone forgets to strip it.
 */
export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  async create(data: CreateUserData): Promise<User> {
    try {
      return await this.users.create({
        ...data,
        email: normalizeEmail(data.email),
        name: data.name.trim(),
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findByEmail(normalizeEmail(email));
  }

  findById(id: string): Promise<User | null> {
    return this.users.findById(id);
  }

  async getProfile(id: string): Promise<UserDto> {
    const user = await this.users.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toUserDto(user);
  }
}
