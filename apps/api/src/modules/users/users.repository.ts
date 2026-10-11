import { Injectable } from '@nestjs/common';
import { User } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateUserData {
  email: string;
  name: string;
  passwordHash: string;
}

/**
 * Data access for users. Only Prisma calls live here, no business rules.
 *
 * WHY a repository layer: services can be unit-tested with a tiny fake instead of
 * mocking Prisma's large fluent API, and swapping the persistence detail later only
 * touches this file.
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  create(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({ data });
  }
}
