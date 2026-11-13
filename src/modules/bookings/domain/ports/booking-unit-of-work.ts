import { IUnitOfWork } from '@common/domain/unit-of-work';
import { IWalletRepository } from '@modules/wallet/domain/repositories/wallet.repository.interface';
import { IBookingRepository } from '../repositories/booking.repository.interface';

/** Repositórios disponíveis numa transação de reserva/cancelamento. */
export interface BookingTransactionScope {
  bookings: IBookingRepository;
  wallet: IWalletRepository;
}

export type IBookingUnitOfWork = IUnitOfWork<BookingTransactionScope>;

export const BOOKING_UNIT_OF_WORK = Symbol('IBookingUnitOfWork');
