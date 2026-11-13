import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { User } from '../../domain/entities/user.entity';
import { UserMapper } from '../prisma/user.mapper';
import { getUniqueViolationFields } from '@database/prisma-errors';
import {
  EmailAlreadyExistsError,
  NifAlreadyExistsError,
} from '../../domain/errors/user.errors';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: User): Promise<User> {
    try {
      const saved = await this.prisma.user.create({
        data: UserMapper.toCreateInput(user),
      });
      return UserMapper.toDomain(saved);
    } catch (error) {
      // Corrida entre dois registos iguais: o UNIQUE da BD decide quem vence.
      // Traduzimos o erro do ORM para um erro de domínio (409), para que os
      // use cases nunca precisem de conhecer códigos do Prisma.
      const fields = getUniqueViolationFields(error);
      if (fields?.includes('email')) throw new EmailAlreadyExistsError();
      if (fields?.includes('nif')) throw new NifAlreadyExistsError();
      throw error;
    }
  }

  async update(user: User): Promise<User> {
    const saved = await this.prisma.user.update({
      where: { id: user.id },
      data: UserMapper.toUpdateInput(user),
    });
    return UserMapper.toDomain(saved);
  }

  async findById(id: string): Promise<User | null> {
    const raw = await this.prisma.user.findUnique({ where: { id } });
    return raw ? UserMapper.toDomain(raw) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const raw = await this.prisma.user.findUnique({ where: { email } });
    return raw ? UserMapper.toDomain(raw) : null;
  }

  async findByNif(nif: string): Promise<User | null> {
    const raw = await this.prisma.user.findUnique({ where: { nif } });
    return raw ? UserMapper.toDomain(raw) : null;
  }
}
