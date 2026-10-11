import { PasswordHasher } from './password-hasher';

// Uses the real argon2 implementation: hashing is security-critical, so we test the
// actual behaviour rather than a mock of it.
describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  describe('hash', () => {
    it('produces an argon2id hash that does not contain the password', async () => {
      const hash = await hasher.hash('correct horse battery staple');

      expect(hash.startsWith('$argon2id$')).toBe(true);
      expect(hash).not.toContain('correct horse');
    });

    it('salts hashes, so the same password hashes differently each time', async () => {
      const [a, b] = await Promise.all([
        hasher.hash('same-password-123'),
        hasher.hash('same-password-123'),
      ]);

      expect(a).not.toBe(b);
    });
  });

  describe('verify', () => {
    it('accepts the right password and rejects a wrong one', async () => {
      const hash = await hasher.hash('correct horse battery staple');

      await expect(
        hasher.verify(hash, 'correct horse battery staple'),
      ).resolves.toBe(true);
      await expect(hasher.verify(hash, 'wrong password!!')).resolves.toBe(
        false,
      );
    });

    it('returns false instead of throwing for a malformed hash', async () => {
      await expect(hasher.verify('not-a-hash', 'whatever')).resolves.toBe(
        false,
      );
    });
  });

  describe('verifyDummy', () => {
    it('resolves without revealing anything', async () => {
      await expect(hasher.verifyDummy('any password')).resolves.toBeUndefined();
    });
  });
});
