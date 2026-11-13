import { Prisma } from '@prisma/client';

/**
 * Se `error` for uma violação de UNIQUE (Prisma `P2002`), devolve os campos
 * envolvidos; caso contrário devolve `null`.
 *
 * Com o driver adapter (`@prisma/adapter-pg`) os campos vêm em
 * `meta.driverAdapterError.cause.constraint.fields`; com o motor nativo vêm em
 * `meta.target`. Suportamos ambos para não depender do modo de ligação.
 */
export function getUniqueViolationFields(error: unknown): string[] | null {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return null;
  }

  const meta = (error.meta ?? {}) as {
    target?: string[] | string;
    driverAdapterError?: { cause?: { constraint?: { fields?: string[] } } };
  };

  const adapterFields = meta.driverAdapterError?.cause?.constraint?.fields;
  if (adapterFields?.length) {
    return adapterFields;
  }
  if (Array.isArray(meta.target)) {
    return meta.target;
  }
  if (typeof meta.target === 'string') {
    return [meta.target];
  }
  return [];
}

/**
 * `true` se o Prisma não encontrou o registo a alterar (`P2025`), por exemplo
 * num `update` cujo `where` deixou de corresponder (linha eliminada entretanto).
 */
export function isRecordNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  );
}
