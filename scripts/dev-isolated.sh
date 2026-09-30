#!/usr/bin/env bash
# Disposable synthetic-only acceptance stack. No .dev.vars reads/writes.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
command -v docker >/dev/null || { echo 'Docker가 필요해요.' >&2; exit 1; }
FIXTURE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/galanda-local.XXXXXX")"
CONTAINER="galanda-local-$(basename "$FIXTURE_DIR")"
STACK_PID=""
cleanup() {
  trap - EXIT INT TERM
  if [ -n "$STACK_PID" ]; then kill "$STACK_PID" 2>/dev/null || true; wait "$STACK_PID" 2>/dev/null || true; fi
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$FIXTURE_DIR"
}
trap cleanup EXIT
trap 'exit 130' INT TERM
# Fixed loopback port: a conflict fails rather than choosing an external database.
docker run --detach --rm --name "$CONTAINER" \
  --publish 127.0.0.1:55432:5432 \
  --tmpfs /var/lib/postgresql/data:rw \
  --env POSTGRES_DB=galanda_local \
  --env POSTGRES_PASSWORD=galanda-local-test-password \
  docker.io/library/postgres:15-alpine >/dev/null
READY=false
for _ in $(seq 1 30); do
  if docker exec "$CONTAINER" pg_isready -U postgres -d galanda_local >/dev/null 2>&1; then READY=true; break; fi
  sleep 1
done
[ "$READY" = true ] || { echo '로컬 DB 준비 시간 초과' >&2; exit 1; }
docker exec -i "$CONTAINER" psql -U postgres -d galanda_local -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
SQL
# This literal cannot be redirected by .dev.vars or inherited migration variables.
MIGRATION_DATABASE_URL='postgresql://postgres:galanda-local-test-password@127.0.0.1:55432/galanda_local' \
  node ./node_modules/drizzle-kit/bin.cjs migrate
docker exec -i "$CONTAINER" psql -U postgres -d galanda_local -v ON_ERROR_STOP=1 -q <<'SQL'
ALTER ROLE galanda_worker LOGIN PASSWORD 'galanda-local-test-password';
SQL
docker exec -i "$CONTAINER" psql -U postgres -d galanda_local -v ON_ERROR_STOP=1 -q < scripts/verify-database-privileges.sql
umask 077
cat > "$FIXTURE_DIR/local.vars" <<'VARS'
APP_ENV="staging"
BETTER_AUTH_SECRET="local-only-synthetic-secret-not-for-deployment"
BETTER_AUTH_URL="http://localhost:5173"
DATABASE_URL="postgresql://galanda_worker:galanda-local-test-password@127.0.0.1:55432/galanda_local"
AI_RECOMMENDATION_MODE="off"
VARS
echo '임시 DB 준비 완료. 합성 데이터만 사용하세요. Ctrl+C로 서버·DB·환경 파일을 정리해요.'
CLOUDFLARE_INCLUDE_PROCESS_ENV=false \
CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=true \
WRANGLER_SEND_METRICS=false \
WRANGLER_LOG_PATH="$FIXTURE_DIR/wrangler.log" \
GALANDA_DEV_STATE_DIR="$FIXTURE_DIR/worker-state" \
GALANDA_DEV_ENV_FILE="$FIXTURE_DIR/local.vars" bash scripts/dev-local.sh "$@" &
STACK_PID=$!
wait "$STACK_PID"
