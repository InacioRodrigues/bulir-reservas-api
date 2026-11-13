import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';

/**
 * Rate limiting por **utilizador** quando o pedido traz um access token
 * válido e por **IP** nos restantes casos (login, registo, tokens inválidos).
 *
 * Porquê: este guard corre antes da autenticação (para travar abuso antes de
 * qualquer trabalho), por isso ainda não há `request.user`. Contar só por IP
 * faria muitos utilizadores atrás do mesmo NAT (rede de empresa, operadora
 * móvel) partilharem o mesmo limite. Verificar a assinatura do JWT aqui é um
 * HMAC em memória (microssegundos, sem BD) e impede que alguém fuja ao
 * limite inventando `sub`s num token não assinado.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  private readonly jwt: JwtService;

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    config: ConfigService,
  ) {
    super(options, storageService, reflector);
    this.jwt = new JwtService({
      secret: config.getOrThrow<string>('jwt.accessSecret'),
      verifyOptions: { algorithms: ['HS256'] },
    });
  }

  protected getTracker(req: Record<string, any>): Promise<string> {
    const subject = this.verifiedSubject(req.headers?.authorization);
    return Promise.resolve(
      subject ? `user:${subject}` : `ip:${String(req.ip)}`,
    );
  }

  private verifiedSubject(header: unknown): string | undefined {
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      return undefined;
    }
    try {
      const payload = this.jwt.verify<{ sub?: unknown }>(header.slice(7));
      return typeof payload.sub === 'string' ? payload.sub : undefined;
    } catch {
      return undefined;
    }
  }
}
