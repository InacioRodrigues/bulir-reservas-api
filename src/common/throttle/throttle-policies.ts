import { ThrottlerOptions } from '@nestjs/throttler';

/**
 * Limites por rota (`@Throttle(...)`), aplicados por cima do limite global
 * (`THROTTLE_LIMIT`/`THROTTLE_TTL`). Os contadores são por rota e por
 * "tracker" (utilizador autenticado ou IP — ver `AppThrottlerGuard`).
 *
 * Os limites configuráveis são lidos em cada pedido (função), para poderem
 * ser ajustados por variável de ambiente (ex.: subir nos testes e2e).
 */
type ThrottlePolicy = Record<
  'default',
  Pick<ThrottlerOptions, 'limit' | 'ttl'>
>;

const ONE_MINUTE = 60_000;

const envLimit = (name: string, fallback: number) => () =>
  Number(process.env[name] ?? fallback);

/**
 * `POST /auth/login` e `POST /auth/register`: trava força bruta de passwords
 * e criação massiva de contas (5/min por IP).
 */
export const CREDENTIALS_THROTTLE: ThrottlePolicy = {
  default: { limit: envLimit('AUTH_THROTTLE_LIMIT', 5), ttl: ONE_MINUTE },
};

/** `POST /auth/refresh`: um cliente legítimo renova a cada ~15 minutos. */
export const REFRESH_THROTTLE: ThrottlePolicy = {
  default: { limit: 20, ttl: ONE_MINUTE },
};

/**
 * Operações que movem dinheiro (`POST /bookings`, `PATCH /bookings/:id/cancel`,
 * `POST /wallet/top-up`): cada uma abre uma transação e bloqueia linhas de
 * saldo. Um utilizador real faz poucas por minuto; um script em ciclo não
 * deve conseguir monopolizar as ligações à BD (10/min por utilizador).
 */
export const MONEY_THROTTLE: ThrottlePolicy = {
  default: { limit: envLimit('MONEY_THROTTLE_LIMIT', 10), ttl: ONE_MINUTE },
};
