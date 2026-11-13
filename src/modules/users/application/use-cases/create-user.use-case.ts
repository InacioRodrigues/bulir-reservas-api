import { Injectable, Inject } from '@nestjs/common';
import {
  IUserRepository,
  USER_REPOSITORY_TOKEN,
} from '../../domain/repositories/user.repository.interface';
import {
  IPasswordHasher,
  PASSWORD_HASHER,
} from '../../domain/ports/password-hasher.interface';
import { User } from '../../domain/entities/user.entity';
import {
  EmailAlreadyExistsError,
  NifAlreadyExistsError,
} from '../../domain/errors/user.errors';
import { normalizeEmail, normalizeNif } from '../../domain/user-identity';
import { CreateUserDto } from '../dto/create-user.dto';

/**
 * Cria uma conta (Cliente ou Prestador de Serviço) com e-mail e NIF únicos.
 *
 * A unicidade é garantida em duas camadas:
 * 1. Verificação prévia → mensagem clara (e-mail OU NIF) no caso normal.
 * 2. UNIQUE na BD → se dois registos iguais chegarem ao mesmo tempo, ambos
 *    passam o passo 1, mas só um INSERT vence; o repositório traduz o erro
 *    `P2002` do outro para o mesmo erro de domínio (409), em vez de um 500.
 */
@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: IUserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: IPasswordHasher,
  ) {}

  async execute(dto: CreateUserDto): Promise<User> {
    // Normalizar aqui também (idempotente): o use case não deve depender de
    // quem o chama ter passado pela validação HTTP.
    const email = normalizeEmail(dto.email);
    const nif = normalizeNif(dto.nif);

    if (await this.userRepository.findByEmail(email)) {
      throw new EmailAlreadyExistsError();
    }
    if (await this.userRepository.findByNif(nif)) {
      throw new NifAlreadyExistsError();
    }

    const passwordHash = await this.passwordHasher.hash(dto.password);

    const user = new User({
      fullName: dto.fullName.trim(),
      nif,
      email,
      passwordHash,
      role: dto.role,
    });

    return this.userRepository.create(user);
  }
}
