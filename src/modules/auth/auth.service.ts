import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Logger,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@database/prisma.service';
import {
  IUserRepository,
  USER_REPOSITORY_TOKEN,
} from '@modules/users/domain/repositories/user.repository.interface';
import { User } from '@modules/users/domain/entities/user.entity';
import { UserMapper } from '@modules/users/infrastructure/prisma/user.mapper';
import { CreateUserUseCase } from '@modules/users/application/use-cases/create-user.use-case';
import { PasswordHelper } from '@common/helpers/password';
import {
  LoginDto,
  RegisterDto,
  ChangePasswordDto,
} from './application/dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly createUserUseCase: CreateUserUseCase,
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.createUserUseCase.execute(dto);

    return this.generateTokens(user);
  }

  async login(dto: LoginDto) {
    const userDomain = await this.userRepository.findByEmail(dto.email);
    if (!userDomain) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const isPasswordValid = await PasswordHelper.verify(
      dto.password,
      userDomain.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return this.generateTokens(userDomain);
  }

  async logout(refreshToken: string, userId: string) {
    // Delete the session row: a later refresh with this token finds nothing
    // and fails with 401 (PostgreSQL is the single source of truth, no Redis).
    // Rotated tokens are kept as `isRevoked` instead, to detect reuse.
    await this.prisma.refreshToken.deleteMany({
      where: { token: refreshToken, userId },
    });
    this.logger.log(`Session logout for user ${userId}`);
  }

  async refreshTokens(token: string) {
    // 1. Verify signature and expiration
    try {
      this.jwtService.verify(token, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado');
    }

    // 2. Find token in DB
    const dbToken = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!dbToken) {
      throw new UnauthorizedException('Token inválido');
    }

    // 3. Detect reuse: if token is already revoked, revoke ALL refresh tokens for the user (suspected attack)
    if (dbToken.isRevoked) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: dbToken.userId },
        data: { isRevoked: true },
      });
      this.logger.warn(
        `Security warning: Revoked Refresh Token reuse attempt by user ${dbToken.userId}! All sessions revoked.`,
      );
      throw new ForbiddenException(
        'Tentativa de reutilização de token detetada. Por favor faça login novamente.',
      );
    }

    // 4. Revoke current token
    await this.prisma.refreshToken.update({
      where: { id: dbToken.id },
      data: { isRevoked: true },
    });

    // 5. Generate new tokens
    const userDomain = UserMapper.toDomain(dbToken.user);
    return this.generateTokens(userDomain);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const userDomain = await this.userRepository.findById(userId);
    if (!userDomain) {
      throw new UnauthorizedException('Utilizador não encontrado');
    }

    const isPasswordValid = await PasswordHelper.verify(
      dto.currentPassword,
      userDomain.passwordHash,
    );
    if (!isPasswordValid) {
      throw new BadRequestException('A palavra-passe atual está incorreta');
    }

    const newPasswordHash = await PasswordHelper.hash(dto.newPassword);
    userDomain.updatePassword(newPasswordHash);
    await this.userRepository.update(userDomain);
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessOptions: JwtSignOptions = {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn: this.configService.get<string>(
        'jwt.accessExpiration',
        '15m',
      ) as any,
    };
    const accessToken = this.jwtService.sign(payload, accessOptions);

    const refreshOptions: JwtSignOptions = {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: this.configService.get<string>(
        'jwt.refreshExpiration',
        '7d',
      ) as any,
    };
    const refreshToken = this.jwtService.sign(payload, refreshOptions);

    const expiresAt = new Date();
    // Parse duration (e.g. 7d = 7 days)
    const refreshLifespan = this.configService.get<string>(
      'jwt.refreshExpiration',
      '7d',
    );
    const days = parseInt(refreshLifespan.replace('d', ''), 10) || 7;
    expiresAt.setDate(expiresAt.getDate() + days);

    // Save refresh token to PostgreSQL
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }
}
