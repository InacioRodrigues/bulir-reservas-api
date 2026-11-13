import { Money } from '@common/domain/money';
import { ValidationException } from '@common/exceptions';
import { isPriceInRange, SERVICE_RULES } from './service-rules';

export interface ServiceProps {
  id?: string;
  name: string;
  description: string;
  /** Decimal com 2 casas, em string (ex.: "1500.00") — nunca float. */
  price: string;
  providerId: string;
  /** Nome do prestador, preenchido pelo repositório nas leituras. */
  providerName?: string;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ServiceChanges {
  name?: string;
  description?: string;
  price?: string;
}

/**
 * Serviço publicado por um prestador.
 *
 * A entidade garante as suas próprias invariantes (nome, descrição e preço
 * válidos), independentemente de quem a usa: a validação HTTP dá mensagens
 * amigáveis, mas é aqui que a regra de negócio vive.
 */
export class Service {
  private props: Required<Omit<ServiceProps, 'providerName'>> & {
    providerName?: string;
  };

  constructor(props: ServiceProps) {
    this.props = {
      id: props.id ?? '',
      name: props.name,
      description: props.description,
      price: props.price,
      providerId: props.providerId,
      providerName: props.providerName,
      deletedAt: props.deletedAt ?? null,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };
  }

  /** Novo serviço (ainda não persistido), com os dados validados. */
  static create(data: {
    name: string;
    description: string;
    price: string;
    providerId: string;
  }): Service {
    return new Service({
      name: Service.validName(data.name),
      description: Service.validDescription(data.description),
      price: Service.validPrice(data.price),
      providerId: data.providerId,
    });
  }

  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get description(): string {
    return this.props.description;
  }
  get price(): string {
    return this.props.price;
  }
  get providerId(): string {
    return this.props.providerId;
  }
  get providerName(): string | undefined {
    return this.props.providerName;
  }
  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isOwnedBy(userId: string): boolean {
    return this.props.providerId === userId;
  }

  isDeleted(): boolean {
    return this.props.deletedAt !== null;
  }

  /** Aplica uma alteração parcial; campos ausentes ficam como estão. */
  update(changes: ServiceChanges): void {
    if (changes.name !== undefined) {
      this.props.name = Service.validName(changes.name);
    }
    if (changes.description !== undefined) {
      this.props.description = Service.validDescription(changes.description);
    }
    if (changes.price !== undefined) {
      this.props.price = Service.validPrice(changes.price);
    }
    this.props.updatedAt = new Date();
  }

  toObject(): ServiceProps {
    return { ...this.props };
  }

  private static validName(value: string): string {
    const name = value.trim();
    const { min, max } = SERVICE_RULES.name;
    if (name.length < min || name.length > max) {
      throw new ValidationException([
        {
          field: 'name',
          message: `O nome deve ter entre ${min} e ${max} caracteres`,
        },
      ]);
    }
    return name;
  }

  private static validDescription(value: string): string {
    const description = value.trim();
    const { min, max } = SERVICE_RULES.description;
    if (description.length < min || description.length > max) {
      throw new ValidationException([
        {
          field: 'description',
          message: `A descrição deve ter entre ${min} e ${max} caracteres`,
        },
      ]);
    }
    return description;
  }

  /** Normaliza para 2 casas ("1500" → "1500.00") e valida 0 < preço ≤ máx. */
  private static validPrice(value: string): string {
    const price = Money.parse(value, 'price');
    if (!isPriceInRange(price)) {
      throw new ValidationException([
        {
          field: 'price',
          message: `O preço deve ser maior que 0 e no máximo ${SERVICE_RULES.price.max.toString()}`,
        },
      ]);
    }
    return price.toString();
  }
}
