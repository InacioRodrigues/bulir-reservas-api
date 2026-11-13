import { Injectable, Inject } from '@nestjs/common';
import {
  IUserRepository,
  USER_REPOSITORY_TOKEN,
} from '../../domain/repositories/user.repository.interface';
import { UserQueryDto } from '../dto/user-query.dto';
import { Paginator, PaginatedResult } from '@common/helpers/paginator';
import { User } from '../../domain/entities/user.entity';

@Injectable()
export class ListUsersUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(query: UserQueryDto): Promise<PaginatedResult<User>> {
    const { page, limit } = Paginator.getSkipLimit(query);

    const { data, total } = await this.userRepository.findAll({
      page,
      limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      search: query.search,
    });

    return Paginator.createResult(data, total, page, limit);
  }
}
