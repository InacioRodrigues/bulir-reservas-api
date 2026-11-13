import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/user.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import { Actor } from '@common/types/actor';
import { UserRole } from '@modules/users/domain/entities/user-role';
import { topUpSchema, TopUpDto } from '../../application/dto/wallet.dto';
import { TopUpWalletUseCase } from '../../application/use-cases/top-up-wallet.use-case';

@Controller('wallet')
export class WalletController {
  constructor(private readonly topUpWallet: TopUpWalletUseCase) {}

  @Post('top-up')
  @Roles(UserRole.CLIENT)
  @HttpCode(HttpStatus.OK)
  async topUp(
    @CurrentUser() actor: Actor,
    @Body(new ZodValidationPipe(topUpSchema)) dto: TopUpDto,
  ) {
    const result = await this.topUpWallet.execute(actor, dto);
    return { message: 'Saldo carregado com sucesso', data: result };
  }
}
