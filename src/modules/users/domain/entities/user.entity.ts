import { UserRole } from '@prisma/client';

export interface UserProps {
  id?: string;
  email: string;
  passwordHash: string;
  name: string;
  role?: UserRole;
  isActive?: boolean;
  isEmailVerified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export class User {
  private props: Required<UserProps>;

  constructor(props: UserProps) {
    this.props = {
      id: props.id || '',
      email: props.email,
      passwordHash: props.passwordHash,
      name: props.name,
      role: props.role || UserRole.USER,
      isActive: props.isActive !== undefined ? props.isActive : true,
      isEmailVerified: props.isEmailVerified || false,
      createdAt: props.createdAt || new Date(),
      updatedAt: props.updatedAt || new Date(),
      deletedAt: props.deletedAt || null,
      createdBy: props.createdBy || null,
      updatedBy: props.updatedBy || null,
    };
  }

  get id(): string {
    return this.props.id;
  }
  get email(): string {
    return this.props.email;
  }
  get passwordHash(): string {
    return this.props.passwordHash;
  }
  get name(): string {
    return this.props.name;
  }
  get role(): UserRole {
    return this.props.role;
  }
  get isActive(): boolean {
    return this.props.isActive;
  }
  get isEmailVerified(): boolean {
    return this.props.isEmailVerified;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }
  get createdBy(): string | null {
    return this.props.createdBy;
  }
  get updatedBy(): string | null {
    return this.props.updatedBy;
  }

  updateName(name: string): void {
    if (!name || name.trim() === '') {
      throw new Error('Name cannot be empty');
    }
    this.props.name = name.trim();
    this.props.updatedAt = new Date();
  }

  changeRole(role: UserRole): void {
    this.props.role = role;
    this.props.updatedAt = new Date();
  }

  activate(): void {
    this.props.isActive = true;
    this.props.updatedAt = new Date();
  }

  deactivate(): void {
    this.props.isActive = false;
    this.props.updatedAt = new Date();
  }

  updatePassword(passwordHash: string): void {
    this.props.passwordHash = passwordHash;
    this.props.updatedAt = new Date();
  }

  toObject(): Required<UserProps> {
    return { ...this.props };
  }
}
