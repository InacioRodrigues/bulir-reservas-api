#!/bin/sh
# Arranque do contentor de produção:
#   1. aplica as migrações pendentes (`prisma migrate deploy` só aplica o que
#      falta e usa um advisory lock no Postgres, por isso é seguro com várias
#      instâncias a arrancar ao mesmo tempo);
#   2. opcionalmente garante as contas de demonstração (seed em modo `ensure`:
#      idempotente, nunca apaga dados);
#   3. substitui o shell pelo Node (`exec`), que passa a receber o SIGTERM do
#      orquestrador e fecha as ligações à BD de forma ordenada.
set -eu

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] A aplicar migrações..."
  ./node_modules/.bin/prisma migrate deploy
fi

if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
  echo "[entrypoint] A garantir dados de demonstração..."
  SEED_MODE=ensure node dist/prisma/seed.js
fi

exec node dist/main.js
