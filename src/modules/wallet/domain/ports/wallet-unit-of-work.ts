import { IUnitOfWork } from '@common/domain/unit-of-work';
import { IWalletRepository } from '../repositories/wallet.repository.interface';

/** Repositórios disponíveis numa transação de carteira. */
export interface WalletTransactionScope {
  wallet: IWalletRepository;
}

export type IWalletUnitOfWork = IUnitOfWork<WalletTransactionScope>;

export const WALLET_UNIT_OF_WORK = Symbol('IWalletUnitOfWork');
