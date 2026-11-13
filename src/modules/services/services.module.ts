import { Module } from '@nestjs/common';
import { SERVICE_REPOSITORY } from './domain/repositories/service.repository.interface';
import { PrismaServiceRepository } from './infrastructure/repositories/prisma-service.repository';
import { CreateServiceUseCase } from './application/use-cases/create-service.use-case';
import { GetServiceUseCase } from './application/use-cases/get-service.use-case';
import { UpdateServiceUseCase } from './application/use-cases/update-service.use-case';
import { DeleteServiceUseCase } from './application/use-cases/delete-service.use-case';
import { ListServicesUseCase } from './application/use-cases/list-services.use-case';
import { ListProviderServicesUseCase } from './application/use-cases/list-provider-services.use-case';
import { ServicesController } from './presentation/controllers/services.controller';

@Module({
  controllers: [ServicesController],
  providers: [
    { provide: SERVICE_REPOSITORY, useClass: PrismaServiceRepository },
    CreateServiceUseCase,
    GetServiceUseCase,
    UpdateServiceUseCase,
    DeleteServiceUseCase,
    ListServicesUseCase,
    ListProviderServicesUseCase,
  ],
  // As reservas (próxima fase) precisam de ler serviços ativos.
  exports: [SERVICE_REPOSITORY],
})
export class ServicesModule {}
