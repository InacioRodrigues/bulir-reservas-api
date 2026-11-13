import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { CreateUserUseCase } from './create-user.use-case';
import {
  USER_REPOSITORY_TOKEN,
  IUserRepository,
} from '../../domain/repositories/user.repository.interface';
import { User } from '../../domain/entities/user.entity';
import { UserRole } from '@prisma/client';
import { CreateUserDto } from '../dto/create-user.dto';

// ─── Mock Factory ─────────────────────────────────────────────────────────────
const mockUserRepository = (): jest.Mocked<IUserRepository> => ({
  create: jest.fn(),
  update: jest.fn(),
  findById: jest.fn(),
  findByEmail: jest.fn(),
  delete: jest.fn(),
  findAll: jest.fn(),
});

// ─── User Builder ─────────────────────────────────────────────────────────────
const buildUser = (overrides: Partial<User> = {}): User =>
  new User({
    id: 'uuid-test-001',
    email: 'test@example.com',
    passwordHash: '$argon2id$hash',
    name: 'Test User',
    role: UserRole.USER,
    isActive: true,
    isEmailVerified: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  });

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('CreateUserUseCase', () => {
  let useCase: CreateUserUseCase;
  let userRepository: jest.Mocked<IUserRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateUserUseCase,
        {
          provide: USER_REPOSITORY_TOKEN,
          useFactory: mockUserRepository,
        },
      ],
    }).compile();

    useCase = module.get<CreateUserUseCase>(CreateUserUseCase);
    userRepository = module.get(USER_REPOSITORY_TOKEN);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  describe('execute()', () => {
    const dto: CreateUserDto = {
      email: 'new@example.com',
      password: 'SecurePassword123',
      name: 'New User',
      role: UserRole.USER,
    };

    it('should create and persist a new user', async () => {
      const savedUser = buildUser({ email: dto.email, name: dto.name });

      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue(savedUser);

      const result = await useCase.execute(dto);

      expect(userRepository.findByEmail).toHaveBeenCalledWith(dto.email);
      expect(userRepository.create).toHaveBeenCalledTimes(1);
      expect(result).toBeInstanceOf(User);
      expect(result.email).toBe(dto.email);
    });

    it('should throw ConflictException when email is already registered', async () => {
      const existingUser = buildUser({ email: dto.email });
      userRepository.findByEmail.mockResolvedValue(existingUser);

      await expect(useCase.execute(dto)).rejects.toThrow(ConflictException);
      expect(userRepository.create).not.toHaveBeenCalled();
    });

    it('should hash the password before persisting', async () => {
      const savedUser = buildUser();
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue(savedUser);

      await useCase.execute(dto);

      const createCall = userRepository.create.mock.calls[0][0];
      // The password hash stored on the entity must not equal the plain-text password
      expect(createCall.passwordHash).not.toBe(dto.password);
      expect(createCall.passwordHash).toBeTruthy();
    });
  });
});
