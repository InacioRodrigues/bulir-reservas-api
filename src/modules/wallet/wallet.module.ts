import { Module } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { PrismaUnitOfWork } from '@database/prisma-unit-of-work';
import { WALLET_REPOSITORY } from './domain/repositories/wallet.repository.interface';
import {
  WALLET_UNIT_OF_WORK,
  WalletTransactionScope,
} from './domain/ports/wallet-unit-of-work';
import { PrismaWalletRepository } from './infrastructure/repositories/prisma-wallet.repository';
import { TopUpWalletUseCase } from './application/use-cases/top-up-wallet.use-case';
import { ListWalletTransactionsUseCase } from './application/use-cases/list-wallet-transactions.use-case';
import { WalletController } from './presentation/controllers/wallet.controller';

@Module({
  controllers: [WalletController],
  providers: [
    // Fora de transação (leituras): o repositório usa o cliente Prisma normal.
    {
      provide: WALLET_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaWalletRepository(prisma),
    },
    // Dentro de transação: um repositório novo sobre o `tx` de cada transação.
    {
      provide: WALLET_UNIT_OF_WORK,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) =>
        new PrismaUnitOfWork<WalletTransactionScope>(prisma, (tx) => ({
          wallet: new PrismaWalletRepository(tx),
        })),
    },
    TopUpWalletUseCase,
    ListWalletTransactionsUseCase,
  ],
  exports: [WALLET_REPOSITORY],
})
export class WalletModule {}
