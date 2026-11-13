import { User } from '../../domain/entities/user.entity';

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: string;
}

export class UserPresenter {
  static toResponse(user: User): UserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt.toISOString(),
    };
  }

  static toResponseCollection(users: User[]): UserResponse[] {
    return users.map((user) => this.toResponse(user));
  }
}
