import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '../../generated/prisma/client';
import { UsersRepository } from './users.repository';
import { normalizeEmail, toUserDto, UsersService } from './users.service';

const user: User = {
  id: '6f1c2c4e-8a52-4f0e-9d0b-0f4a3a1e9b11',
  email: 'ann@example.com',
  name: 'Ann',
  passwordHash: '$argon2id$secret-hash',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('UsersService', () => {
  let repo: jest.Mocked<
    Pick<UsersRepository, 'create' | 'findByEmail' | 'findById'>
  >;
  let service: UsersService;

  beforeEach(() => {
    repo = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
    };
    service = new UsersService(repo as unknown as UsersRepository);
  });

  describe('create', () => {
    it('stores a normalised email and trimmed name', async () => {
      repo.create.mockResolvedValue(user);

      await service.create({
        email: '  Ann@Example.COM ',
        name: '  Ann  ',
        passwordHash: 'hash',
      });

      expect(repo.create).toHaveBeenCalledWith({
        email: 'ann@example.com',
        name: 'Ann',
        passwordHash: 'hash',
      });
    });

    it('throws ConflictException when the email is already taken', async () => {
      repo.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.create({
          email: 'ann@example.com',
          name: 'Ann',
          passwordHash: 'h',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rethrows unexpected errors unchanged', async () => {
      const failure = new Error('connection lost');
      repo.create.mockRejectedValue(failure);

      await expect(
        service.create({
          email: 'ann@example.com',
          name: 'Ann',
          passwordHash: 'h',
        }),
      ).rejects.toBe(failure);
    });
  });

  describe('findByEmail', () => {
    it('looks up the normalised email', async () => {
      repo.findByEmail.mockResolvedValue(user);

      await expect(service.findByEmail(' ANN@example.com')).resolves.toBe(user);
      expect(repo.findByEmail).toHaveBeenCalledWith('ann@example.com');
    });
  });

  describe('findById', () => {
    it('returns null when the user does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.findById('missing')).resolves.toBeNull();
    });
  });

  describe('getProfile', () => {
    it('returns the public profile without the password hash', async () => {
      repo.findById.mockResolvedValue(user);

      const profile = await service.getProfile(user.id);

      expect(profile).toEqual({
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      expect(profile).not.toHaveProperty('passwordHash');
    });

    it('throws NotFoundException for an unknown user', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.getProfile('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});

describe('normalizeEmail', () => {
  it('trims and lower-cases', () => {
    expect(normalizeEmail('  Ann@Example.COM ')).toBe('ann@example.com');
  });
});

describe('toUserDto', () => {
  it('serialises createdAt as ISO 8601', () => {
    expect(toUserDto(user).createdAt).toBe('2026-01-01T00:00:00.000Z');
  });
});
