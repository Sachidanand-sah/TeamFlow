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
