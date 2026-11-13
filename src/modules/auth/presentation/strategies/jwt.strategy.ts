import { Injectable, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import {
  IUserRepository,
  USER_REPOSITORY_TOKEN,
} from '@modules/users/domain/repositories/user.repository.interface';
import { UserRole } from '@modules/users/domain/entities/user-role';
import { UnauthorizedException } from '@common/exceptions';
import { RequestContext } from '@common/helpers/request-context';

/** O que fica em `request.user` (e em `@CurrentUser()`). */
export interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.accessSecret'),
      algorithms: ['HS256'],
    });
  }

  /**
   * A assinatura já foi validada. Confirmamos ainda que o utilizador existe e
   * usamos o papel ATUAL da BD (não o do token): custa uma leitura por chave
   * primária, mas uma conta removida deixa de ter acesso de imediato.
   */
  async validate(payload: { sub: string }): Promise<AuthenticatedUser> {
    const user = await this.userRepository.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Token de acesso inválido ou expirado');
    }

    RequestContext.userId = user.id;
    RequestContext.roles = [user.role];

    return { id: user.id, role: user.role };
  }
}
