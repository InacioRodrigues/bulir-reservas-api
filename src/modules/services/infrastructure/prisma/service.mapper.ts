import { Prisma } from '@prisma/client';
import { Service } from '../../domain/entities/service.entity';

/** Colunas lidas em todas as consultas: o serviço + id/nome do prestador. */
export const serviceSelect = {
  id: true,
  name: true,
  description: true,
  price: true,
  providerId: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  // JOIN numa só query (sem N+1) e só com os campos públicos do prestador:
  // nunca carregamos password hash, NIF ou saldo de quem publicou.
  provider: { select: { id: true, fullName: true } },
} satisfies Prisma.ServiceSelect;

export type ServiceRow = Prisma.ServiceGetPayload<{
  select: typeof serviceSelect;
}>;

export class ServiceMapper {
  static toDomain(raw: ServiceRow): Service {
    return new Service({
      id: raw.id,
      name: raw.name,
      description: raw.description,
      // Decimal → string com 2 casas, sem passar por `number`.
      price: raw.price.toFixed(2),
      providerId: raw.providerId,
      providerName: raw.provider.fullName,
      deletedAt: raw.deletedAt,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }

  static toCreateInput(domain: Service): Prisma.ServiceUncheckedCreateInput {
    return {
      name: domain.name,
      description: domain.description,
      price: domain.price,
      providerId: domain.providerId,
    };
  }

  /** Só os campos editáveis: `providerId` e `deletedAt` nunca mudam por aqui. */
  static toUpdateInput(domain: Service): Prisma.ServiceUncheckedUpdateInput {
    return {
      name: domain.name,
      description: domain.description,
      price: domain.price,
    };
  }
}
