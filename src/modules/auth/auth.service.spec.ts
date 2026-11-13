import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { USER_REPOSITORY_TOKEN } from '@modules/users/domain/repositories/user.repository.interface';
import { User } from '@modules/users/domain/entities/user.entity';
import { UserRole } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { CreateUserUseCase } from '@modules/users/application/use-cases/create-user.use-case';
import * as argon2 from 'argon2';

// ─── Mock User Builder ────────────────────────────────────────────────────────
const buildUser = (overrides: Partial<any> = {}): User =>
  new User({
    id: 'user-uuid-001',
    email: 'user@example.com',
    passwordHash: '',
    name: 'Test User',
    role: UserRole.USER,
    isActive: true,
    isEmailVerified: true,
    ...overrides,
  });

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: any;
  let prisma: any;

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-token'),
    verify: jest.fn().mockReturnValue({
      sub: 'user-uuid-001',
      email: 'user@example.com',
      role: UserRole.USER,
    }),
  };

  const mockConfigService = {
    get: jest.fn((key: string, def?: any) => {
      const config: Record<string, any> = {
        'jwt.accessSecret': 'test-access-secret',
        'jwt.accessExpiration': '15m',
        'jwt.refreshSecret': 'test-refresh-secret',
        'jwt.refreshExpiration': '7d',
        'app.appUrl': 'http://localhost:3000',
      };
      return config[key] ?? def;
    }),
  };

  beforeEach(async () => {
    userRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
    };

    prisma = {
      refreshToken: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: prisma },
        { provide: USER_REPOSITORY_TOKEN, useValue: userRepository },
        { provide: CreateUserUseCase, useValue: { execute: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── Login ──────────────────────────────────────────────────────────────────
  describe('login()', () => {
    it('should return tokens for valid credentials', async () => {
      const plainPassword = 'Password@123';
      const hash = await argon2.hash(plainPassword);
      const user = buildUser({ passwordHash: hash });

      userRepository.findByEmail.mockResolvedValue(user);
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({
        email: user.email,
        password: plainPassword,
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const hash = await argon2.hash('correct-password');
      const user = buildUser({ passwordHash: hash });
      userRepository.findByEmail.mockResolvedValue(user);

      await expect(
        service.login({ email: user.email, password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'any' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException for inactive user', async () => {
      const hash = await argon2.hash('Password@123');
      const user = buildUser({ passwordHash: hash, isActive: false });
      userRepository.findByEmail.mockResolvedValue(user);

      await expect(
        service.login({ email: user.email, password: 'Password@123' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── Refresh Token ───────────────────────────────────────────────────────────
  describe('refreshTokens()', () => {
    it('should throw UnauthorizedException if token is not stored (e.g. after logout)', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refreshTokens('logged-out-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if token signature is invalid', async () => {
      mockJwtService.verify.mockImplementationOnce(() => {
        throw new Error('invalid signature');
      });

      await expect(service.refreshTokens('tampered-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.findUnique).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException and revoke all sessions on reused revoked token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-001',
        userId: 'user-uuid-001',
        isRevoked: true,
        user: {
          id: 'user-uuid-001',
          email: 'user@example.com',
          role: UserRole.USER,
        },
      });

      await expect(service.refreshTokens('reused-token')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isRevoked: true } }),
      );
    });
  });

  // ─── Logout ──────────────────────────────────────────────────────────────────
  describe('logout()', () => {
    it('should delete the refresh token session of the user', async () => {
      await service.logout('refresh-token', 'user-uuid-001');

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { token: 'refresh-token', userId: 'user-uuid-001' },
      });
    });
  });
});
