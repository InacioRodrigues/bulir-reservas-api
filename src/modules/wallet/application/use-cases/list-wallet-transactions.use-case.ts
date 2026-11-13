import { Inject, Injectable } from '@nestjs/common';
import { Page } from '@common/pagination/pagination';
import { Actor } from '@common/types/actor';
import { WalletTransaction } from '../../domain/entities/wallet-transaction.entity';
import {
  IWalletRepository,
  WALLET_REPOSITORY,
} from '../../domain/repositories/wallet.repository.interface';
import { WalletTransactionsQueryDto } from '../dto/wallet.dto';

/**
 * Extrato da carteira do utilizador autenticado (cliente ou prestador).
 * Só os próprios movimentos: o `userId` vem sempre do token, nunca da query.
 */
@Injectable()
export class ListWalletTransactionsUseCase {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly wallet: IWalletRepository,
  ) {}

  execute(
    actor: Actor,
    query: WalletTransactionsQueryDto,
  ): Promise<Page<WalletTransaction>> {
    return this.wallet.findTransactions(actor.id, query);
  }
}
