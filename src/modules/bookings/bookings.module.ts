import { Module } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { PrismaUnitOfWork } from '@database/prisma-unit-of-work';
import { ServicesModule } from '@modules/services/services.module';
import { PrismaWalletRepository } from '@modules/wallet/infrastructure/repositories/prisma-wallet.repository';
import { BOOKING_REPOSITORY } from './domain/repositories/booking.repository.interface';
import {
  BOOKING_UNIT_OF_WORK,
  BookingTransactionScope,
} from './domain/ports/booking-unit-of-work';
import { PrismaBookingRepository } from './infrastructure/repositories/prisma-booking.repository';
import { CreateBookingUseCase } from './application/use-cases/create-booking.use-case';
import { CancelBookingUseCase } from './application/use-cases/cancel-booking.use-case';
import { GetBookingUseCase } from './application/use-cases/get-booking.use-case';
import { ListBookingsUseCase } from './application/use-cases/list-bookings.use-case';
import { BookingsController } from './presentation/controllers/bookings.controller';

@Module({
  imports: [ServicesModule],
  controllers: [BookingsController],
  providers: [
    {
      provide: BOOKING_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) =>
        new PrismaBookingRepository(prisma),
    },
    // Reserva e carteira partilham o mesmo `tx`: as escritas nas duas
    // tabelas (e em `users.balance`) ficam na mesma transação.
    {
      provide: BOOKING_UNIT_OF_WORK,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) =>
        new PrismaUnitOfWork<BookingTransactionScope>(prisma, (tx) => ({
          bookings: new PrismaBookingRepository(tx),
          wallet: new PrismaWalletRepository(tx),
        })),
    },
    CreateBookingUseCase,
    CancelBookingUseCase,
    GetBookingUseCase,
    ListBookingsUseCase,
  ],
})
export class BookingsModule {}
