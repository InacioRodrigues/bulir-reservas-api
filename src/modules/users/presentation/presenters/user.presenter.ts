import { User } from '../../domain/entities/user.entity';
import { UserRole } from '../../domain/entities/user-role';

/** Forma pública do utilizador (ver `User` em CONTRATO-API.md). */
export interface UserResponse {
  id: string;
  fullName: string;
  nif: string;
  email: string;
  role: UserRole;
  balance: string;
  createdAt: string;
}

export class UserPresenter {
  static toResponse(user: User): UserResponse {
    return {
      id: user.id,
      fullName: user.fullName,
      nif: user.nif,
      email: user.email,
      role: user.role,
      balance: user.balance,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
