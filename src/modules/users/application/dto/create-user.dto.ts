import { z } from 'zod';
import { UserRole } from '../../domain/entities/user-role';

// Regras completas (normalização de e-mail/NIF, força da password) na Fase 2.
export const createUserSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  nif: z.string().trim().min(1).max(20),
  email: z.string().trim().email('Endereço de email inválido').max(255),
  password: z
    .string()
    .min(8, 'A palavra-passe deve conter pelo menos 8 caracteres'),
  role: z.enum([UserRole.CLIENT, UserRole.PROVIDER]),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
