import { z } from 'zod';
import { UserRole } from '@prisma/client';

export const createUserSchema = z.object({
  email: z.string().email('Endereço de email inválido'),
  password: z
    .string()
    .min(8, 'A palavra-passe deve conter pelo menos 8 caracteres'),
  name: z.string().min(2, 'O nome deve conter pelo menos 2 caracteres'),
  role: z.nativeEnum(UserRole).default(UserRole.USER),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
