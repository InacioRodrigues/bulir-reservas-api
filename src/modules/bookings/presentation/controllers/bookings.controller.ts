import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/user.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import { UuidParamPipe } from '@common/pipes/uuid-param.pipe';
import { Actor } from '@common/types/actor';
import { UserRole } from '@modules/users/domain/entities/user-role';
import {
  createBookingSchema,
  CreateBookingDto,
} from '../../application/dto/booking.dto';
import { CreateBookingUseCase } from '../../application/use-cases/create-booking.use-case';
import { CancelBookingUseCase } from '../../application/use-cases/cancel-booking.use-case';
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
  ) {}

  @Post()
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
