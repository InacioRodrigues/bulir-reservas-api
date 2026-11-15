import { User } from './user.entity';
import { UserRole } from './user-role';

const props = {
  fullName: 'Ana Cliente',
  nif: '123456789LA041',
  email: 'ana@exemplo.ao',
  passwordHash: 'hash',
  role: UserRole.CLIENT,
};

describe('User', () => {
  it('um utilizador novo começa com saldo 0.00 e datas preenchidas', () => {
    const user = new User(props);

    expect(user.balance).toBe('0.00');
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
    expect(user.id).toBe('');
  });

  it('preserva os valores vindos da BD', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const user = new User({
      ...props,
      id: 'u-1',
      balance: '1500.50',
      createdAt,
      updatedAt: createdAt,
    });

    expect(user).toMatchObject({
      id: 'u-1',
      fullName: props.fullName,
      nif: props.nif,
      email: props.email,
      passwordHash: 'hash',
      role: UserRole.CLIENT,
      balance: '1500.50',
      createdAt,
      updatedAt: createdAt,
    });
  });

  it('distingue cliente de prestador', () => {
    const client = new User(props);
    const provider = new User({ ...props, role: UserRole.PROVIDER });

    expect([client.isClient(), client.isProvider()]).toEqual([true, false]);
    expect([provider.isClient(), provider.isProvider()]).toEqual([false, true]);
  });

  it('toObject devolve uma cópia: alterá-la não muda a entidade', () => {
    const user = new User({ ...props, balance: '10.00' });
    const copy = user.toObject();
    copy.balance = '999.00';

    expect(user.balance).toBe('10.00');
  });
});
