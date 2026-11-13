import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/user.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import { UuidParamPipe } from '@common/pipes/uuid-param.pipe';
import { Page, toPageMeta } from '@common/pagination/pagination';
import { Actor } from '@common/types/actor';
import { UserRole } from '@modules/users/domain/entities/user-role';
import { Service } from '../../domain/entities/service.entity';
import {
  createServiceSchema,
  CreateServiceDto,
  listServicesQuerySchema,
  ListServicesQueryDto,
  myServicesQuerySchema,
  MyServicesQueryDto,
  updateServiceSchema,
  UpdateServiceDto,
} from '../../application/dto/service.dto';
import { CreateServiceUseCase } from '../../application/use-cases/create-service.use-case';
import { GetServiceUseCase } from '../../application/use-cases/get-service.use-case';
import { UpdateServiceUseCase } from '../../application/use-cases/update-service.use-case';
import { DeleteServiceUseCase } from '../../application/use-cases/delete-service.use-case';
import { ListServicesUseCase } from '../../application/use-cases/list-services.use-case';
import { ListProviderServicesUseCase } from '../../application/use-cases/list-provider-services.use-case';
import { ServicePresenter } from '../presenters/service.presenter';

const toPageResponse = (page: Page<Service>, message: string) => ({
  message,
  data: page.items.map((service) => ServicePresenter.toResponse(service)),
  meta: toPageMeta(page),
});

/**
 * Controller fino: valida a entrada, passa o utilizador autenticado ao use
 * case e formata a saída. As regras (papel, dono, eliminado) estão nos use
 * cases; `@Roles` só rejeita cedo quem nunca poderia passar.
 */
@Controller('services')
export class ServicesController {
  constructor(
    private readonly createService: CreateServiceUseCase,
    private readonly getService: GetServiceUseCase,
    private readonly updateService: UpdateServiceUseCase,
    private readonly deleteService: DeleteServiceUseCase,
    private readonly listServices: ListServicesUseCase,
    private readonly listProviderServices: ListProviderServicesUseCase,
  ) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(listServicesQuerySchema))
    query: ListServicesQueryDto,
  ) {
    const page = await this.listServices.execute(query);
    return toPageResponse(page, 'Serviços obtidos com sucesso');
  }

  // Declarada antes de `:id`, senão "mine" seria tratado como um id.
  @Get('mine')
  @Roles(UserRole.PROVIDER)
  async mine(
    @CurrentUser() actor: Actor,
    @Query(new ZodValidationPipe(myServicesQuerySchema))
    query: MyServicesQueryDto,
  ) {
    const page = await this.listProviderServices.execute(actor, query);
    return toPageResponse(page, 'Os seus serviços obtidos com sucesso');
  }

  @Get(':id')
  async findOne(@Param('id', UuidParamPipe) id: string) {
    const service = await this.getService.execute(id);
    return {
      message: 'Serviço obtido com sucesso',
      data: ServicePresenter.toResponse(service),
    };
  }

  @Post()
  @Roles(UserRole.PROVIDER)
  async create(
    @CurrentUser() actor: Actor,
    @Body(new ZodValidationPipe(createServiceSchema)) dto: CreateServiceDto,
  ) {
    const service = await this.createService.execute(actor, dto);
    return {
      message: 'Serviço criado com sucesso',
      data: ServicePresenter.toResponse(service),
    };
  }

  @Patch(':id')
  @Roles(UserRole.PROVIDER)
  async update(
    @CurrentUser() actor: Actor,
    @Param('id', UuidParamPipe) id: string,
    @Body(new ZodValidationPipe(updateServiceSchema)) dto: UpdateServiceDto,
  ) {
    const service = await this.updateService.execute(actor, id, dto);
    return {
      message: 'Serviço atualizado com sucesso',
      data: ServicePresenter.toResponse(service),
    };
  }

  @Delete(':id')
  @Roles(UserRole.PROVIDER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() actor: Actor,
    @Param('id', UuidParamPipe) id: string,
  ): Promise<void> {
    await this.deleteService.execute(actor, id);
  }
}
