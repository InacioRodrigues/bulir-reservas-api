-- Regras de integridade que o schema Prisma não consegue exprimir.
-- A aplicação valida tudo isto antes (zod + use cases), mas a BD é a última
-- linha de defesa: mesmo com um bug ou uma corrida, estes estados são impossíveis.

-- ─── users ──────────────────────────────────────────────────────────────────
-- Saldo nunca negativo. Se um UPDATE concorrente tentar deixar o saldo < 0,
-- o PostgreSQL rejeita-o e a transação inteira faz rollback.
ALTER TABLE "users"
  ADD CONSTRAINT "users_balance_non_negative" CHECK ("balance" >= 0);

-- E-mail sempre em minúsculas: combinado com o UNIQUE, garante unicidade
-- case-insensitive ("Ana@x.ao" e "ana@x.ao" não podem coexistir).
ALTER TABLE "users"
  ADD CONSTRAINT "users_email_lowercase" CHECK ("email" = lower("email"));

-- NIF normalizado (maiúsculas, sem espaços) pela mesma razão.
ALTER TABLE "users"
  ADD CONSTRAINT "users_nif_normalized" CHECK ("nif" = upper("nif") AND "nif" !~ '\s');

-- ─── services ───────────────────────────────────────────────────────────────
ALTER TABLE "services"
  ADD CONSTRAINT "services_price_positive" CHECK ("price" > 0);

-- ─── bookings ───────────────────────────────────────────────────────────────
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_price_positive" CHECK ("price" > 0);

-- Um prestador não reserva o próprio serviço.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_client_not_provider" CHECK ("client_id" <> "provider_id");

-- Estado coerente: CANCELLED <=> tem data e autor de cancelamento.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_cancellation_consistent" CHECK (
    ("status" = 'CONFIRMED' AND "cancelled_at" IS NULL AND "cancelled_by_id" IS NULL)
    OR
    ("status" = 'CANCELLED' AND "cancelled_at" IS NOT NULL AND "cancelled_by_id" IS NOT NULL)
  );

-- ─── wallet_transactions ────────────────────────────────────────────────────
-- Movimentos de valor zero não fazem sentido no ledger.
ALTER TABLE "wallet_transactions"
  ADD CONSTRAINT "wallet_transactions_amount_non_zero" CHECK ("amount" <> 0);

-- O sinal do valor tem de corresponder ao tipo de movimento.
ALTER TABLE "wallet_transactions"
  ADD CONSTRAINT "wallet_transactions_amount_sign" CHECK (
    ("type" IN ('TOP_UP', 'BOOKING_CREDIT', 'REFUND_CREDIT') AND "amount" > 0)
    OR
    ("type" IN ('BOOKING_DEBIT', 'REFUND_DEBIT') AND "amount" < 0)
  );

-- Movimentos de reserva têm de referir a reserva; o carregamento não.
ALTER TABLE "wallet_transactions"
  ADD CONSTRAINT "wallet_transactions_booking_link" CHECK (
    ("type" = 'TOP_UP' AND "booking_id" IS NULL)
    OR
    ("type" <> 'TOP_UP' AND "booking_id" IS NOT NULL)
  );

ALTER TABLE "wallet_transactions"
  ADD CONSTRAINT "wallet_transactions_balance_after_non_negative" CHECK ("balance_after" >= 0);
