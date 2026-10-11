import { NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';

/**
 * True when a write failed because it would break a UNIQUE constraint (Prisma P2002).
 *
 * WHY catch this instead of "check first, then insert": two concurrent requests can
 * both pass a check before either inserts. The database constraint is the only
 * race-free source of truth, so we let it decide and translate the error.
 */
export function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

/**
 * True when an update/delete matched no row (Prisma P2025), e.g. because another
 * request deleted it between our read and our write.
 */
export function isRecordNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  );
}

/** Awaits a write and turns "no row matched" into a 404 with `message`. */
export async function orNotFound<T>(
  write: Promise<T>,
  message: string,
): Promise<T> {
  try {
    return await write;
  } catch (error) {
    if (isRecordNotFound(error)) {
      throw new NotFoundException(message);
    }
    throw error;
  }
}
