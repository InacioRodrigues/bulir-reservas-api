import { CreateUserUseCase } from './create-user.use-case';
import { UserRole } from '../../domain/entities/user-role';
import {
  EmailAlreadyExistsError,
  NifAlreadyExistsError,
} from '../../domain/errors/user.errors';
import { CreateUserDto } from '../dto/create-user.dto';
import { InMemoryUserRepository } from '@test/fakes/in-memory-user.repository';
import { FakePasswordHasher } from '@test/fakes/fake-password-hasher';

describe('CreateUserUseCase', () => {
  let users: InMemoryUserRepository;
  let useCase: CreateUserUseCase;

  const dto: CreateUserDto = {
    fullName: 'Ana Paula Domingos',
    nif: '004512345LA041',
    email: 'ana@bulir.ao',
    password: 'Senha123',
    role: UserRole.CLIENT,
  };

  beforeEach(() => {
    users = new InMemoryUserRepository();
    useCase = new CreateUserUseCase(users, new FakePasswordHasher());
  });

  it('cria o utilizador com saldo 0.00 e password em hash', async () => {
    const user = await useCase.execute(dto);

    expect(user.id).toBeTruthy();
    expect(user.balance).toBe('0.00');
    expect(user.role).toBe(UserRole.CLIENT);
    expect(user.passwordHash).not.toBe(dto.password);
    expect(users.items).toHaveLength(1);
  });

  it('normaliza e-mail (minúsculas) e NIF (maiúsculas, sem espaços)', async () => {
    const user = await useCase.execute({
      ...dto,
      email: '  Ana@Bulir.AO ',
      nif: ' 004 512 345 la 041 ',
    });

    expect(user.email).toBe('ana@bulir.ao');
    expect(user.nif).toBe('004512345LA041');
  });

  it('rejeita e-mail duplicado sem distinguir maiúsculas (409 EMAIL_ALREADY_EXISTS)', async () => {
    await useCase.execute(dto);

    const promise = useCase.execute({
      ...dto,
      nif: '999999999LA999',
      email: 'ANA@BULIR.AO',
    });

    await expect(promise).rejects.toBeInstanceOf(EmailAlreadyExistsError);
    await expect(promise).rejects.toMatchObject({
      code: 'EMAIL_ALREADY_EXISTS',
    });
    expect(users.items).toHaveLength(1);
  });

  it('rejeita NIF duplicado (409 NIF_ALREADY_EXISTS)', async () => {
    await useCase.execute(dto);

    await expect(
      useCase.execute({
        ...dto,
        email: 'outra@bulir.ao',
        nif: '004512345la041',
      }),
    ).rejects.toMatchObject({ code: 'NIF_ALREADY_EXISTS', status: 409 });
  });

  it('em corrida (verificação prévia passa nos dois), o UNIQUE da BD ainda devolve 409', async () => {
    // Simula dois pedidos simultâneos: ambos veem "não existe" no passo 1.
    jest.spyOn(users, 'findByEmail').mockResolvedValue(null);
    jest.spyOn(users, 'findByNif').mockResolvedValue(null);

    const results = await Promise.allSettled([
      useCase.execute(dto),
      useCase.execute(dto),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected');
    expect(rejected?.reason).toBeInstanceOf(EmailAlreadyExistsError);
    expect(users.items).toHaveLength(1);
  });

  it('permite registar um prestador de serviço', async () => {
    const user = await useCase.execute({ ...dto, role: UserRole.PROVIDER });
    expect(user.isProvider()).toBe(true);
  });

  it('NifAlreadyExistsError é um 409', () => {
    expect(new NifAlreadyExistsError().getStatus()).toBe(409);
  });
});
