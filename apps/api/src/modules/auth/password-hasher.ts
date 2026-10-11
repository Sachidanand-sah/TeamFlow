import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Password hashing with argon2id.
 *
 * WHY argon2id: it is deliberately slow and memory-hard, so an attacker who steals
 * the database cannot test billions of guesses per second on GPUs (unlike SHA-256).
 * It also salts every hash automatically, so equal passwords get different hashes.
 */
@Injectable()
export class PasswordHasher {
  private dummyHash?: Promise<string>;

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  /** Never throws: a malformed stored hash simply fails verification. */
  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  /**
   * Spends the same time as a real verification, for logins with an unknown email.
   *
   * WHY: if "unknown email" answered instantly and "wrong password" took ~50 ms,
   * an attacker could time responses to discover which emails have accounts.
   */
  async verifyDummy(plain: string): Promise<void> {
    this.dummyHash ??= this.hash('timing-equalisation-dummy-password');
    await this.verify(await this.dummyHash, plain);
  }
}
