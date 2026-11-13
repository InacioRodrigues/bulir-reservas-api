import { z } from 'zod';
import { createUserSchema } from '@modules/users/application/dto/create-user.dto';

export const registerSchema = createUserSchema;

/**
 * `identifier` aceita e-mail ou NIF. Não aplicamos aqui as regras de formato
 * do registo: um identificador mal formado simplesmente não encontra conta e
 * devolve o mesmo 401 genérico.
 */
export const loginSchema = z.object({
  identifier: z
    .string({ error: 'Indique o e-mail ou o NIF' })
    .trim()
    .min(1, 'Indique o e-mail ou o NIF')
    .max(255),
  password: z
    .string({ error: 'A palavra-passe é obrigatória' })
    .min(1, 'A palavra-passe é obrigatória')
    .max(128),
});

export const refreshSchema = z.object({
  refreshToken: z
    .string({ error: 'O refresh token é obrigatório' })
    .min(1, 'O refresh token é obrigatório')
    .max(2048),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type RefreshDto = z.infer<typeof refreshSchema>;
