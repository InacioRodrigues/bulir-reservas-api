import { Prisma, User as PrismaUser } from '@prisma/client';
import { User } from '../../domain/entities/user.entity';

export class UserMapper {
  static toDomain(raw: PrismaUser): User {
    return new User({
      id: raw.id,
      fullName: raw.fullName,
      nif: raw.nif,
      email: raw.email,
      passwordHash: raw.passwordHash,
      role: raw.role,
      // Prisma devolve Decimal (decimal.js): convertemos para string com 2 casas
      // sem passar por `number`, para não perder precisão.
      balance: raw.balance.toFixed(2),
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }

  /** Dados para INSERT. Sem `id` (gerado pela BD) e sem `balance` (default 0). */
  static toCreateInput(domain: User): Prisma.UserCreateInput {
    return {
      fullName: domain.fullName,
      nif: domain.nif,
      email: domain.email,
      passwordHash: domain.passwordHash,
      role: domain.role,
    };
  }

  /**
   * Dados para UPDATE de perfil. O `balance` fica de fora de propósito:
   * escrever aqui um saldo lido antes seria um "lost update" se uma reserva
   * concorrente o tivesse alterado entretanto.
   */
  static toUpdateInput(domain: User): Prisma.UserUpdateInput {
    return {
      fullName: domain.fullName,
      passwordHash: domain.passwordHash,
    };
  }
}
