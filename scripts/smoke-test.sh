#!/usr/bin/env bash
# Smoke test da imagem de produção: constrói a imagem, sobe API + PostgreSQL
# com docker-compose.yml (segredos aleatórios, BD descartável) e verifica com
# curl os fluxos principais. No fim apaga contentores e volume.
#
#   ./scripts/smoke-test.sh            # porta 3100
#   API_PORT=3200 ./scripts/smoke-test.sh
#   KEEP=1 ./scripts/smoke-test.sh     # deixa o ambiente a correr
set -euo pipefail

cd "$(dirname "$0")/.."

export API_PORT="${API_PORT:-3100}"
export APP_URL="http://localhost:${API_PORT}"
export POSTGRES_PASSWORD="$(openssl rand -hex 16)"
export JWT_ACCESS_SECRET="$(openssl rand -base64 48)"
export JWT_REFRESH_SECRET="$(openssl rand -base64 48)"
export SEED_DEMO_DATA=true

PROJECT=bulir-reservas-smoke
BASE="${APP_URL}/api/v1"
compose() { docker compose -p "$PROJECT" -f docker-compose.yml "$@"; }

cleanup() {
  if [ "${KEEP:-0}" != "1" ]; then
    compose down -v --remove-orphans >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

fail() {
  echo "FALHOU: $*" >&2
  compose logs --tail 50 api >&2 || true
  exit 1
}

# check <descrição> <status esperado> <curl args...>
check() {
  local name="$1" expected="$2"
  shift 2
  local status
  status=$(curl -s -o /tmp/smoke-body.json -w '%{http_code}' "$@")
  if [ "$status" != "$expected" ]; then
    fail "$name → $status (esperado $expected): $(cat /tmp/smoke-body.json)"
  fi
  echo "ok  $status  $name"
}

json() { node -e "const b=JSON.parse(require('fs').readFileSync('/tmp/smoke-body.json','utf8'));console.log($1)"; }

echo "==> A construir e arrancar (porta ${API_PORT})..."
# Começa sempre de uma BD vazia (a password é nova a cada execução).
compose down -v --remove-orphans >/dev/null 2>&1 || true
compose up -d --build --wait --wait-timeout 180 || fail "contentores não ficaram saudáveis"
docker inspect --format 'healthcheck da imagem: {{.State.Health.Status}}' "$(compose ps -q api)"
echo "utilizador do processo: $(compose exec -T api id -un)"

echo "==> Smoke test"
check "GET /health" 200 "${BASE}/health"
check "GET /openapi.json" 200 "${APP_URL}/openapi.json"
[ "$(json 'b.servers[0].url')" = "$APP_URL" ] || fail "servidor da spec OpenAPI não é ${APP_URL}"
check "GET /reference" 200 "${APP_URL}/reference"
check "GET /auth/me sem token" 401 "${BASE}/auth/me"

check "POST /auth/login (cliente demo, por NIF)" 200 -X POST "${BASE}/auth/login" \
  -H 'Content-Type: application/json' -d '{"identifier":"004512345LA041","password":"Senha@123"}'
TOKEN=$(json 'b.data.accessToken')

check "GET /services" 200 "${BASE}/services?perPage=1&sort=price_asc" -H "Authorization: Bearer ${TOKEN}"
SERVICE_ID=$(json 'b.data[0].id')

check "POST /bookings" 201 -X POST "${BASE}/bookings" -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' -d "{\"serviceId\":\"${SERVICE_ID}\"}"
BOOKING_ID=$(json 'b.data.id')

check "PATCH /bookings/:id/cancel" 200 -X PATCH "${BASE}/bookings/${BOOKING_ID}/cancel" \
  -H "Authorization: Bearer ${TOKEN}"
check "PATCH /bookings/:id/cancel (2.ª vez)" 409 -X PATCH "${BASE}/bookings/${BOOKING_ID}/cancel" \
  -H "Authorization: Bearer ${TOKEN}"

check "GET /auth/me" 200 "${BASE}/auth/me" -H "Authorization: Bearer ${TOKEN}"
[ "$(json 'b.data.balance')" = "50000.00" ] || fail "saldo após reembolso não é 50000.00"

echo "==> Reinício: migrações e seed são idempotentes"
compose restart api >/dev/null
compose up -d --wait --wait-timeout 120 >/dev/null || fail "API não voltou saudável após reinício"
# (sem `grep -q`: com pipefail, sair cedo daria SIGPIPE ao `compose logs`)
compose logs api 2>&1 | grep "já existem" >/dev/null || fail "seed não reconheceu as contas existentes"
check "GET /health após reinício" 200 "${BASE}/health"

echo "==> Smoke test concluído com sucesso"
