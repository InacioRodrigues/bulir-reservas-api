import { UserRole } from '@modules/users/domain/entities/user-role';

/**
 * Quem está a executar a operação (o utilizador autenticado).
 *
 * Os use cases recebem o `Actor` explicitamente em vez de lerem o pedido
 * HTTP: as regras de permissão ficam testáveis sem servidor e não dependem
 * do framework.
 */
export interface Actor {
  id: string;
  role: UserRole;
}
