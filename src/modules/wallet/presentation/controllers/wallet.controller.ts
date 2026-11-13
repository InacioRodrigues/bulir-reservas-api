import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '@common/decorators/roles.decorator';
import { MONEY_THROTTLE } from '@common/throttle/throttle-policies';
import { CurrentUser } from '@common/decorators/user.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import { Actor } from '@common/types/actor';
import { toPageMeta } from '@common/pagination/pagination';
import { UserRole } from '@modules/users/domain/entities/user-role';
import {
  topUpSchema,
  TopUpDto,
  walletTransactionsQuerySchema,
  WalletTransactionsQueryDto,
} from '../../application/dto/wallet.dto';
import { TopUpWalletUseCase } from '../../application/use-cases/top-up-wallet.use-case';
import { ListWalletTransactionsUseCase } from '../../application/use-cases/list-wallet-transactions.use-case';
import { WalletTransactionPresenter } from '../presenters/wallet-transaction.presenter';

@Controller('wallet')
export class WalletController {
  constructor(
    private readonly topUpWallet: TopUpWalletUseCase,
    private readonly listTransactions: ListWalletTransactionsUseCase,
  ) {}

  @Post('top-up')
  @Throttle(MONEY_THROTTLE)
  @Roles(UserRole.CLIENT)
  @HttpCode(HttpStatus.OK)
  async topUp(
    @CurrentUser() actor: Actor,
    @Body(new ZodValidationPipe(topUpSchema)) dto: TopUpDto,
  ) {
    const result = await this.topUpWallet.execute(actor, dto);
    return { message: 'Saldo carregado com sucesso', data: result };
  }

  /** Extrato do próprio utilizador (cliente ou prestador), paginado. */
  @Get('transactions')
  async transactions(
    @CurrentUser() actor: Actor,
    @Query(new ZodValidationPipe(walletTransactionsQuerySchema))
    query: WalletTransactionsQueryDto,
  ) {
    const page = await this.listTransactions.execute(actor, query);
    return {
      message: 'Movimentos obtidos com sucesso',
      data: page.items.map((t) => WalletTransactionPresenter.toResponse(t)),
      meta: toPageMeta(page),
    };
  }
}
