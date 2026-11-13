/**
 * Papéis da plataforma. Definido no domínio (e não importado de `@prisma/client`)
 * para que as regras de negócio não dependam do ORM — os valores coincidem com
 * o enum `UserRole` da BD, por isso o mapper não precisa de conversão.
 */
export const UserRole = {
  CLIENT: 'CLIENT',
  PROVIDER: 'PROVIDER',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];
