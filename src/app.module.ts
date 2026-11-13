import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';

import { configurations, validateEnv } from './config/configuration';
import { loggerConfig } from './config/logger.config';

import { PrismaModule } from './database/prisma.module';

import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';

import { RequestContextMiddleware } from './common/middlewares/request-context.middleware';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: configurations,
      validate: validateEnv,
    }),

    // Structured logging using Pino
    LoggerModule.forRoot(loggerConfig),

    // Rate Limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('app.throttle.ttl', 60) * 1000,
          limit: config.get<number>('app.throttle.limit', 100),
        },
      ],
    }),

    // Infrastructure & Providers
    PrismaModule,

    // Core Business Modules
    UsersModule,
    AuthModule,
    HealthModule,
  ],
  providers: [
    // Global Guard for authentication
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global Guard for Role-Based Access Control
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    // Global Throttler guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global Success response wrapper
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    // Global Exception Filter formatting
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Inject Request ID and Correlation ID context to all requests
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
