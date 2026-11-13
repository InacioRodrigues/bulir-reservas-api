import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Endereço de email inválido'),
  password: z
    .string()
    .min(8, 'A palavra-passe deve conter pelo menos 8 caracteres'),
  name: z.string().min(2, 'O nome deve conter pelo menos 2 caracteres'),
});

export const loginSchema = z.object({
  email: z.string().email('Endereço de email inválido'),
  password: z.string(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'O Refresh Token é obrigatório'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'A palavra-passe atual é obrigatória'),
  newPassword: z
    .string()
    .min(8, 'A nova palavra-passe deve conter pelo menos 8 caracteres'),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type RefreshDto = z.infer<typeof refreshSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
