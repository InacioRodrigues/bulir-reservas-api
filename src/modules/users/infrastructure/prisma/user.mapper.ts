import { User as PrismaUser } from '@prisma/client';
import { User } from '../../domain/entities/user.entity';

export class UserMapper {
  static toDomain(raw: PrismaUser): User {
    return new User({
      id: raw.id,
      email: raw.email,
      passwordHash: raw.passwordHash,
      name: raw.name,
      role: raw.role,
      isActive: raw.isActive,
      isEmailVerified: raw.isEmailVerified,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      deletedAt: raw.deletedAt,
      createdBy: raw.createdBy,
      updatedBy: raw.updatedBy,
    });
  }

  static toPersistence(domain: User): PrismaUser {
    return {
      id: domain.id,
      email: domain.email,
      passwordHash: domain.passwordHash,
      name: domain.name,
      role: domain.role,
      isActive: domain.isActive,
      isEmailVerified: domain.isEmailVerified,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
      deletedAt: domain.deletedAt,
      createdBy: domain.createdBy,
      updatedBy: domain.updatedBy,
    };
  }
}
