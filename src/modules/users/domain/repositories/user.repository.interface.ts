import { User } from '../entities/user.entity';
import { PaginationParams } from '@common/helpers/paginator';

export interface IUserRepository {
  create(user: User): Promise<User>;
  update(user: User): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  delete(id: string): Promise<void>;
  findAll(params: PaginationParams): Promise<{ data: User[]; total: number }>;
}

export const USER_REPOSITORY_TOKEN = Symbol('IUserRepository');
