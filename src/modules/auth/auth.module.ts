import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '@modules/users/users.module';
import { TOKEN_SERVICE } from './domain/ports/token-service.interface';
import { REFRESH_TOKEN_REPOSITORY } from './domain/repositories/refresh-token.repository.interface';
import { JwtTokenService } from './infrastructure/security/jwt-token.service';
import { PrismaRefreshTokenRepository } from './infrastructure/repositories/prisma-refresh-token.repository';
import { SessionIssuer } from './application/services/session-issuer';
import { RegisterUseCase } from './application/use-cases/register.use-case';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { RefreshSessionUseCase } from './application/use-cases/refresh-session.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { JwtStrategy } from './presentation/strategies/jwt.strategy';
import { AuthController } from './presentation/controllers/auth.controller';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // Segredos/expiração passados em cada sign/verify (access ≠ refresh).
    JwtModule.register({}),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      useClass: PrismaRefreshTokenRepository,
    },
    SessionIssuer,
    RegisterUseCase,
    LoginUseCase,
    RefreshSessionUseCase,
    LogoutUseCase,
    JwtStrategy,
  ],
})
export class AuthModule {}
