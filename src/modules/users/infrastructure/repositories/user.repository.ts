import { Injectable } from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { User } from '../../domain/entities/user.entity';
import { UserMapper } from '../prisma/user.mapper';
import { PaginationParams, Paginator } from '@common/helpers/paginator';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: User): Promise<User> {
    const { id, ...rest } = UserMapper.toPersistence(user);
    // If ID is empty string, omit it so DB/Prisma generates UUID
    const data = id ? { id, ...rest } : rest;
    const saved = await this.prisma.user.create({ data });
    return UserMapper.toDomain(saved);
  }

  async update(user: User): Promise<User> {
    const raw = UserMapper.toPersistence(user);
    const saved = await this.prisma.user.update({
      where: { id: user.id },
      data: raw,
    });
    return UserMapper.toDomain(saved);
  }

  async findById(id: string): Promise<User | null> {
    const raw = await this.prisma.user.findUnique({
      where: { id },
    });
    return raw ? UserMapper.toDomain(raw) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    // Treat email findUnique properly
    const raw = await this.prisma.user.findUnique({
      where: { email },
    });
    return raw ? UserMapper.toDomain(raw) : null;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({
      where: { id },
    });
  }

  async findAll(
    params: PaginationParams,
  ): Promise<{ data: User[]; total: number }> {
    const { skip, take } = Paginator.getSkipLimit(params);

    const where: any = {};
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [rawUsers, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: {
          [params.sortBy || 'createdAt']: params.sortOrder || 'desc',
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: rawUsers.map((user) => UserMapper.toDomain(user)),
      total,
    };
  }
}
