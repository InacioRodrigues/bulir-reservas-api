import { z } from 'zod';
import { UserRole } from '../../domain/entities/user-role';
import { normalizeEmail, normalizeNif } from '../../domain/user-identity';

/**
 * NIF angolano: pessoa singular = nº do BI (9 dígitos + 2 letras + 3 dígitos,
 * ex. 004512345LA041); pessoa coletiva = 10 dígitos. Aceitamos 9–14 letras e
 * dígitos (sem validar o dígito de controlo) — o essencial é ser alfanumérico,
 * para nunca conter "@" e o login por e-mail OU NIF ser inequívoco.
 */
const NIF_PATTERN = /^[A-Z0-9]{9,14}$/;

export const createUserSchema = z.object({
  fullName: z
    .string({ error: 'O nome completo é obrigatório' })
    .trim()
    .min(3, 'O nome completo deve ter pelo menos 3 caracteres')
    .max(120, 'O nome completo deve ter no máximo 120 caracteres'),
  nif: z
    .string({ error: 'O NIF é obrigatório' })
    .transform(normalizeNif)
    .pipe(
      z.string().regex(NIF_PATTERN, 'O NIF deve ter 9 a 14 letras ou dígitos'),
    ),
  email: z
    .string({ error: 'O e-mail é obrigatório' })
    .transform(normalizeEmail)
    .pipe(
      z
        .email('Endereço de e-mail inválido')
        .max(255, 'O e-mail deve ter no máximo 255 caracteres'),
    ),
  password: z
    .string({ error: 'A palavra-passe é obrigatória' })
    .min(8, 'A palavra-passe deve ter pelo menos 8 caracteres')
    // Limite superior: o hashing é caro de propósito; sem limite, um corpo
    // com uma password de 1 MB seria um vetor fácil de negação de serviço.
    .max(128, 'A palavra-passe deve ter no máximo 128 caracteres')
    .regex(/[A-Za-z]/, 'A palavra-passe deve conter pelo menos uma letra')
    .regex(/\d/, 'A palavra-passe deve conter pelo menos um número'),
  role: z.enum([UserRole.CLIENT, UserRole.PROVIDER], {
    error: 'O perfil deve ser CLIENT ou PROVIDER',
  }),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
