import {
  Controller,
  Post,
  Get,
  Body,
  UsePipes,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { GetUserUseCase } from '@modules/users/application/use-cases/get-user.use-case';
import { UserPresenter } from '@modules/users/presentation/presenters/user.presenter';
import { Public } from '@common/decorators/public.decorator';
import {
  CREDENTIALS_THROTTLE,
  REFRESH_THROTTLE,
} from '@common/throttle/throttle-policies';
import { CurrentUser } from '@common/decorators/user.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import {
  registerSchema,
  RegisterDto,
  loginSchema,
  LoginDto,
  refreshSchema,
  RefreshDto,
} from '../../application/dto/auth.dto';
import {
  AuthResult,
  RegisterUseCase,
} from '../../application/use-cases/register.use-case';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { RefreshSessionUseCase } from '../../application/use-cases/refresh-session.use-case';
import { LogoutUseCase } from '../../application/use-cases/logout.use-case';

const toAuthResponse = (result: AuthResult) => ({
  user: UserPresenter.toResponse(result.user),
  accessToken: result.accessToken,
  refreshToken: result.refreshToken,
});

/** Controller fino: valida a entrada, chama o use case e formata a saída. */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshSessionUseCase: RefreshSessionUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly getUserUseCase: GetUserUseCase,
  ) {}

  @Public()
  @Throttle(CREDENTIALS_THROTTLE)
  @Post('register')
  @UsePipes(new ZodValidationPipe(registerSchema))
  async register(@Body() dto: RegisterDto) {
    const result = await this.registerUseCase.execute(dto);
    return {
      message: 'Conta criada com sucesso',
      data: toAuthResponse(result),
    };
  }

  @Public()
  @Throttle(CREDENTIALS_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(loginSchema))
  async login(@Body() dto: LoginDto) {
    const result = await this.loginUseCase.execute(dto);
    return {
      message: 'Sessão iniciada com sucesso',
      data: toAuthResponse(result),
    };
  }

  @Public()
  @Throttle(REFRESH_THROTTLE)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(refreshSchema))
  async refresh(@Body() dto: RefreshDto) {
    const tokens = await this.refreshSessionUseCase.execute(dto.refreshToken);
    return { message: 'Sessão renovada com sucesso', data: tokens };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(refreshSchema)) dto: RefreshDto,
  ): Promise<void> {
    await this.logoutUseCase.execute(userId, dto.refreshToken);
  }

  @Get('me')
  async me(@CurrentUser('id') userId: string) {
    const user = await this.getUserUseCase.execute(userId);
    return {
      message: 'Perfil obtido com sucesso',
      data: UserPresenter.toResponse(user),
    };
  }
}
