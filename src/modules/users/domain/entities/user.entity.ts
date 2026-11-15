import { UserRole } from './user-role';

export interface UserProps {
  id?: string;
  fullName: string;
  nif: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  /** Decimal com 2 casas, em string (ex.: "1500.00") — nunca float. */
  balance?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class User {
  private props: Required<UserProps>;

  constructor(props: UserProps) {
    this.props = {
      id: props.id ?? '',
      fullName: props.fullName,
      nif: props.nif,
      email: props.email,
      passwordHash: props.passwordHash,
      role: props.role,
      balance: props.balance ?? '0.00',
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };
  }

  get id(): string {
    return this.props.id;
  }
  get fullName(): string {
    return this.props.fullName;
  }
  get nif(): string {
    return this.props.nif;
  }
  get email(): string {
    return this.props.email;
  }
  get passwordHash(): string {
    return this.props.passwordHash;
  }
  get role(): UserRole {
    return this.props.role;
  }
  /**
   * Saldo lido da BD. É só leitura: o saldo muda apenas através de updates
   * condicionais e atómicos na carteira/reservas, nunca via `update(user)`.
   */
  get balance(): string {
    return this.props.balance;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isClient(): boolean {
    return this.props.role === UserRole.CLIENT;
  }

  isProvider(): boolean {
    return this.props.role === UserRole.PROVIDER;
  }

  toObject(): Required<UserProps> {
    return { ...this.props };
  }
}
