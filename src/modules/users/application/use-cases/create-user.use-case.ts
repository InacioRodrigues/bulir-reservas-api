import { Injectable, Inject, ConflictException } from '@nestjs/common';
import {
  IUserRepository,
  USER_REPOSITORY_TOKEN,
} from '../../domain/repositories/user.repository.interface';
import { User } from '../../domain/entities/user.entity';
import { CreateUserDto } from '../dto/create-user.dto';
import { PasswordHelper } from '@common/helpers/password';

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(dto: CreateUserDto): Promise<User> {
    const existingUser = await this.userRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException(
        'Um utilizador com este email já está registado',
      );
    }

    const passwordHash = await PasswordHelper.hash(dto.password);

    const user = new User({
      email: dto.email,
      passwordHash,
      name: dto.name,
      role: dto.role,
    });

    return this.userRepository.create(user);
  }
}
