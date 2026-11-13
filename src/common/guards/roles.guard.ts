import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@modules/users/domain/entities/user-role';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ForbiddenException } from '../exceptions/http.exceptions';

/**
 * Guard global de papéis: só atua em rotas com `@Roles(...)`.
 *
 * Verifica apenas o papel (CLIENT/PROVIDER). Regras que dependem dos dados
 * (ex.: "só o dono edita o serviço") ficam nos use cases, porque precisam
 * de ler o recurso e fazem parte da regra de negócio.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const user = context.switchToHttp().getRequest().user as
      { role: UserRole } | undefined;

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        'O seu perfil não tem permissão para esta operação',
      );
    }

    return true;
  }
}
