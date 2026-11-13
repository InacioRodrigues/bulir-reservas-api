import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  UsePipes,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from '../../auth.service';
import { GetUserUseCase } from '@modules/users/application/use-cases/get-user.use-case';
import { UserPresenter } from '@modules/users/presentation/presenters/user.presenter';
import { Public } from '@common/decorators/public.decorator';
import { CurrentUser } from '@common/decorators/user.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import {
  registerSchema,
  RegisterDto,
  loginSchema,
  LoginDto,
  refreshSchema,
  RefreshDto,
  changePasswordSchema,
  ChangePasswordDto,
} from '../../application/dto/auth.dto';

@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly getUserUseCase: GetUserUseCase,
  ) {}

  @Public()
  @Post('register')
  @UsePipes(new ZodValidationPipe(registerSchema))
  async register(@Body() dto: RegisterDto) {
    const tokens = await this.authService.register(dto);
    return {
      message: 'Utilizador registado com sucesso',
      data: tokens,
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(loginSchema))
  async login(@Body() dto: LoginDto) {
    const tokens = await this.authService.login(dto);
    return {
      message: 'Login efetuado com sucesso',
      data: tokens,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(refreshSchema))
  async logout(@Body() dto: RefreshDto, @CurrentUser('id') userId: string) {
    await this.authService.logout(dto.refreshToken, userId);
    return {
      message: 'Logout efetuado com sucesso',
      data: null,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(refreshSchema))
  async refresh(@Body() dto: RefreshDto) {
    const tokens = await this.authService.refreshTokens(dto.refreshToken);
    return {
      message: 'Tokens atualizados com sucesso',
      data: tokens,
    };
  }

  @Patch('change-password')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(changePasswordSchema))
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(userId, dto);
    return {
      message: 'Palavra-passe alterada com sucesso',
      data: null,
    };
  }

  @Get('me')
  async getProfile(@CurrentUser('id') userId: string) {
    const user = await this.getUserUseCase.execute(userId);
    return {
      message: 'Perfil recuperado com sucesso',
      data: UserPresenter.toResponse(user),
    };
  }
}
