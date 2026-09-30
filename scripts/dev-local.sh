#!/usr/bin/env bash
set -euo pipefail

# 로컬 개발 스택을 한 번에 띄워요.
#
#   브라우저 → Vite dev server (SPA + HMR, 기본 5173)
#                └─ /api/* proxy → wrangler dev (Hono/Effect Worker, 기본 8787)
#                                    └─ DATABASE_URL → 로컬 PostgreSQL
#
# Vite dev server는 `/api/*`를 서빙하지 않아요. proxy 없이 실행하면 `/api/*`가
# SPA fallback HTML을 받아 로그인·세션이 조용히 깨져요.
# production에서는 Cloudflare assets의 `run_worker_first: ["/api/*"]`가 같은 역할을 해요.
#
# Vite에 넘길 인자는 그대로 전달돼요. 예: bash scripts/dev-local.sh --mode ait
#
# 환경 변수:
#   GALANDA_DEV_VITE_PORT    (기본 5173)
#   GALANDA_DEV_WORKER_PORT  (기본 8787)

cd "$(dirname "${BASH_SOURCE[0]}")/.."

VITE_PORT="${GALANDA_DEV_VITE_PORT:-5173}"
WORKER_PORT="${GALANDA_DEV_WORKER_PORT:-8787}"
BROWSER_ORIGIN="http://localhost:${VITE_PORT}"

# An explicit fixture file keeps existing developer credentials untouched.
ENV_FILE="${GALANDA_DEV_ENV_FILE:-.dev.vars}"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ 로컬 환경 파일이 없어요. docs/local-development.md 를 확인해 주세요." >&2
  exit 1
fi
# Parse dotenv without sourcing shell code; never print configuration values.
node --input-type=module - "$ENV_FILE" <<'JS'
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
const fail = (message) => { console.error(message); process.exit(1); };
try {
  const vars = parseEnv(readFileSync(process.argv[2], 'utf8'));
  const db = new URL(vars.DATABASE_URL || '');
  if (!['postgres:', 'postgresql:'].includes(db.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(db.hostname)) {
    fail('❌ 로컬 개발은 loopback PostgreSQL만 사용해요. 원격 검증은 별도 운영 절차를 따라 주세요.');
  }
  if ((vars.BETTER_AUTH_SECRET || '').trim().length < 32) {
    fail('❌ 로컬 BETTER_AUTH_SECRET은 32자 이상이어야 해요.');
  }
} catch {
  fail('❌ 로컬 환경 파일의 DATABASE_URL 형식을 확인해 주세요. 값은 출력하지 않아요.');
}
JS

# wrangler는 assets 디렉터리가 존재해야 실행돼요.
# 이 모드에서는 브라우저가 Vite에서 SPA를 받으므로 dist 내용은 사용되지 않아요.
mkdir -p dist

# ----------------------------------------------------------------- 프로세스
WORKER_PID=""
VITE_PID=""

stop_tree() {
  local child
  for child in $(pgrep -P "$1" 2>/dev/null || true); do stop_tree "$child"; done
  kill "$1" 2>/dev/null || true
}

cleanup() {
  trap - EXIT INT TERM
  [ -n "$VITE_PID" ] && stop_tree "$VITE_PID"
  [ -n "$WORKER_PID" ] && stop_tree "$WORKER_PID"
  wait 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT TERM

echo "▶ Worker API   http://localhost:${WORKER_PORT}  (/api/*)"
echo "▶ Vite dev     ${BROWSER_ORIGIN}  ← 브라우저는 여기로 접속해요"
echo

# Better Auth의 baseURL/redirect_uri는 브라우저가 보는 origin과 같아야 해요.
# 이 모드에서는 브라우저가 Vite origin을 사용하므로 .dev.vars 값을 덮어써요.
./node_modules/.bin/wrangler dev --local \
  --persist-to "${GALANDA_DEV_STATE_DIR:-.wrangler/state}" \
  --ip 127.0.0.1 \
  --env-file "$ENV_FILE" \
  --port "$WORKER_PORT" \
  --var "BETTER_AUTH_URL:${BROWSER_ORIGIN}" \
  --show-interactive-dev-session=false &
WORKER_PID=$!

READY=false
for _ in $(seq 1 60); do
  if curl --max-time 2 -sf -o /dev/null "http://127.0.0.1:${WORKER_PORT}/api/health"; then READY=true; break; fi
  kill -0 "$WORKER_PID" 2>/dev/null || { echo "❌ Worker가 종료됐어요." >&2; exit 1; }
  sleep 1
done

if [ "$READY" != true ]; then
  echo "❌ Worker 준비 시간 초과" >&2
  exit 1
fi

GALANDA_DEV_API_TARGET="http://127.0.0.1:${WORKER_PORT}" \
  ./node_modules/.bin/vite --host 127.0.0.1 --port "$VITE_PORT" --strictPort "$@" &
VITE_PID=$!

# 둘 중 하나라도 종료되면 전체를 정리해요. (macOS 기본 bash 3.2에는 `wait -n`이 없어요)
while kill -0 "$WORKER_PID" 2>/dev/null && kill -0 "$VITE_PID" 2>/dev/null; do
  sleep 1
done
