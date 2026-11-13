import { createUserSchema } from './create-user.dto';

describe('createUserSchema', () => {
  const valid = {
    fullName: 'Ana Paula Domingos',
    nif: '004512345LA041',
    email: 'ana@bulir.ao',
    password: 'Senha123',
    role: 'CLIENT',
  };

  const fieldsWithError = (input: unknown) => {
    const result = createUserSchema.safeParse(input);
    return result.success ? [] : result.error.issues.map((i) => i.path[0]);
  };

  it('aceita um registo válido e normaliza e-mail/NIF', () => {
    const data = createUserSchema.parse({
      ...valid,
      email: ' ANA@Bulir.ao ',
      nif: '004 512 345 la041',
    });
    expect(data.email).toBe('ana@bulir.ao');
    expect(data.nif).toBe('004512345LA041');
  });

  it('remove campos desconhecidos (ex.: balance), impedindo mass assignment', () => {
    const data = createUserSchema.parse({ ...valid, balance: '999999.00' });
    expect(data).not.toHaveProperty('balance');
  });

  it.each([
    ['password curta', { password: 'Ab1' }, 'password'],
    ['password sem número', { password: 'SoLetras' }, 'password'],
    ['password sem letra', { password: '12345678' }, 'password'],
    ['e-mail inválido', { email: 'nao-e-email' }, 'email'],
    ['NIF com @', { nif: 'ana@bulir.ao' }, 'nif'],
    ['NIF curto', { nif: '12345' }, 'nif'],
    ['nome curto', { fullName: 'Al' }, 'fullName'],
    ['papel inexistente', { role: 'ROOT' }, 'role'],
  ])('rejeita %s', (_label, override, field) => {
    expect(fieldsWithError({ ...valid, ...override })).toContain(field);
  });
});
