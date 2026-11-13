import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UnauthorizedException } from '../exceptions/http.exceptions';

/**
 * Guard global: todas as rotas exigem `Authorization: Bearer <accessToken>`,
 * exceto as marcadas com `@Public()`. "Seguro por omissão": uma rota nova
 * esquecida fica protegida, em vez de ficar aberta.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  /**
   * Sem token, token mal assinado ou expirado → 401 `UNAUTHORIZED` no formato
   * do contrato (em vez do erro genérico do Passport).
   */
  handleRequest<TUser = any>(err: unknown, user: TUser | false): TUser {
    if (err instanceof UnauthorizedException) {
      throw err;
    }
    if (err || !user) {
      throw new UnauthorizedException('Token de acesso inválido ou expirado');
    }
    return user;
  }
}
