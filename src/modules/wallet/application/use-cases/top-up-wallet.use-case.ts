import { Inject, Injectable } from '@nestjs/common';
import { Money } from '@common/domain/money';
import { Actor } from '@common/types/actor';
import { NotFoundException } from '@common/exceptions';
import { UserRole } from '@modules/users/domain/entities/user-role';
import { WalletTransactionType } from '../../domain/entities/wallet-transaction.entity';
import { TopUpClientOnlyError } from '../../domain/errors/wallet.errors';
import {
  IWalletUnitOfWork,
  WALLET_UNIT_OF_WORK,
} from '../../domain/ports/wallet-unit-of-work';
import { TopUpDto } from '../dto/wallet.dto';

export interface TopUpResult {
  balance: string;
}

/**
 * Carregamento de saldo (simulado: não há gateway de pagamento no âmbito do
 * desafio). Crédito e registo no ledger na mesma transação.
 */
@Injectable()
export class TopUpWalletUseCase {
  constructor(
    @Inject(WALLET_UNIT_OF_WORK)
    private readonly unitOfWork: IWalletUnitOfWork,
  ) {}

  async execute(actor: Actor, dto: TopUpDto): Promise<TopUpResult> {
    if (actor.role !== UserRole.CLIENT) {
      throw new TopUpClientOnlyError();
    }

    const transaction = await this.unitOfWork.run(({ wallet }) =>
      wallet.applyMovement({
        userId: actor.id,
        type: WalletTransactionType.TOP_UP,
        amount: Money.parse(dto.amount),
      }),
    );
    // Um crédito só não é aplicado se a conta não existir.
    if (!transaction) {
      throw new NotFoundException('Utilizador não encontrado');
    }

    return { balance: transaction.balanceAfter };
  }
}
