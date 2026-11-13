import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '@common/decorators/roles.decorator';
import { MONEY_THROTTLE } from '@common/throttle/throttle-policies';
import { CurrentUser } from '@common/decorators/user.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import { UuidParamPipe } from '@common/pipes/uuid-param.pipe';
import { Actor } from '@common/types/actor';
import { toPageMeta } from '@common/pagination/pagination';
import { UserRole } from '@modules/users/domain/entities/user-role';
import {
  createBookingSchema,
  CreateBookingDto,
  listBookingsQuerySchema,
  ListBookingsQueryDto,
} from '../../application/dto/booking.dto';
import { CreateBookingUseCase } from '../../application/use-cases/create-booking.use-case';
import { CancelBookingUseCase } from '../../application/use-cases/cancel-booking.use-case';
import { GetBookingUseCase } from '../../application/use-cases/get-booking.use-case';
import { ListBookingsUseCase } from '../../application/use-cases/list-bookings.use-case';
import { BookingPresenter } from '../presenters/booking.presenter';

/**
 * Controller fino: valida a entrada e passa o utilizador autenticado ao use
 * case. Saldo, permissões e estado são decididos nos use cases.
 */
@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly createBooking: CreateBookingUseCase,
    private readonly cancelBooking: CancelBookingUseCase,
    private readonly getBooking: GetBookingUseCase,
    private readonly listBookings: ListBookingsUseCase,
  ) {}

  /** Reservas em que o utilizador participa (cliente ou prestador). */
  @Get()
  async list(
    @CurrentUser() actor: Actor,
    @Query(new ZodValidationPipe(listBookingsQuerySchema))
    query: ListBookingsQueryDto,
  ) {
    const page = await this.listBookings.execute(actor, query);
    return {
      message: 'Reservas obtidas com sucesso',
      data: page.items.map((booking) => BookingPresenter.toResponse(booking)),
      meta: toPageMeta(page),
    };
  }

  @Get(':id')
  async findOne(
    @CurrentUser() actor: Actor,
    @Param('id', UuidParamPipe) id: string,
  ) {
    const booking = await this.getBooking.execute(actor, id);
    return {
      message: 'Reserva obtida com sucesso',
      data: BookingPresenter.toResponse(booking),
    };
  }

  @Post()
  @Throttle(MONEY_THROTTLE)
  @Roles(UserRole.CLIENT)
  async create(
    @CurrentUser() actor: Actor,
    @Body(new ZodValidationPipe(createBookingSchema)) dto: CreateBookingDto,
  ) {
    const booking = await this.createBooking.execute(actor, dto);
    return {
      message: 'Reserva criada com sucesso',
      data: BookingPresenter.toResponse(booking),
    };
  }

  /** Cliente da reserva ou prestador do serviço (verificado no use case). */
  @Patch(':id/cancel')
  @Throttle(MONEY_THROTTLE)
  async cancel(
    @CurrentUser() actor: Actor,
    @Param('id', UuidParamPipe) id: string,
  ) {
    const booking = await this.cancelBooking.execute(actor, id);
    return {
      message: 'Reserva cancelada e valor reembolsado',
      data: BookingPresenter.toResponse(booking),
    };
  }
}
