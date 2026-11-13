import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import {
  IUserRepository,
  USER_REPOSITORY_TOKEN,
} from '@modules/users/domain/repositories/user.repository.interface';
import { RequestContext } from '@common/helpers/request-context';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret') ?? '',
    });
  }

  async validate(payload: { sub: string }) {
    const userDomain = await this.userRepository.findById(payload.sub);
    if (!userDomain) {
      throw new UnauthorizedException('Utilizador não encontrado');
    }

    // Populate global Request Context details for auditing & tracing
    RequestContext.userId = userDomain.id;
    RequestContext.roles = [userDomain.role];

    return {
      id: userDomain.id,
      email: userDomain.email,
      role: userDomain.role,
    };
  }
}
