import { z } from 'zod';
import { Money } from '@common/domain/money';
import { paginationQuerySchema } from '@common/pagination/pagination';
import { isTopUpInRange, WALLET_RULES } from '../../domain/wallet-rules';

const MONEY_FORMAT_MESSAGE =
  'O valor deve ser uma string decimal com até 2 casas, ex.: "5000.00"';

/**
 * `amount` como string decimal (um número JSON já passou por float → 400),
 * > 0 e ≤ 1 000 000.00. Campos desconhecidos são descartados.
 */
export const topUpSchema = z.object({
  amount: z
    .string({ error: MONEY_FORMAT_MESSAGE })
    .trim()
    .refine(Money.isValid, { error: MONEY_FORMAT_MESSAGE })
    .transform((value) => Money.parse(value))
    .refine(isTopUpInRange, {
      error: `O valor deve ser maior que 0 e no máximo ${WALLET_RULES.topUp.max.toString()}`,
    })
    .transform((amount) => amount.toString()),
});

export type TopUpDto = z.infer<typeof topUpSchema>;

export const walletTransactionsQuerySchema = paginationQuerySchema;

export type WalletTransactionsQueryDto = z.infer<
  typeof walletTransactionsQuerySchema
>;
