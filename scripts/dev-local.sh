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

# --------------------------------------------------------------- 사전 점검
if [ ! -f .dev.vars ]; then
  cat >&2 <<'MSG'
❌ .dev.vars 가 없어요. 로컬 Worker는 여기서 secret/DB URL을 읽어요.
   최소 필요한 키: BETTER_AUTH_SECRET, BETTER_AUTH_URL, DATABASE_URL
   자세한 내용: docs/local-development.md
MSG
  exit 1
fi

# 주석 처리되지 않은 DATABASE_URL 행만 확인해요. (값은 출력하지 않아요)
DB_LINE="$(grep -E '^[[:space:]]*DATABASE_URL=' .dev.vars | tail -1 || true)"

if [ -z "$DB_LINE" ]; then
  cat >&2 <<'MSG'
❌ .dev.vars 에 DATABASE_URL 이 없어요.
   로컬 DB를 준비하려면: pnpm db:setup:local
MSG
  exit 1
fi

if printf '%s' "$DB_LINE" | grep -qE 'supabase\.(co|com)'; then
  cat >&2 <<'MSG'
⚠️  DATABASE_URL 이 원격 Supabase 를 가리켜요.
   로컬 Worker가 staging 데이터에 직접 쓰게 되고, Direct endpoint는 IPv6 전용이라
   대부분의 로컬 네트워크에서는 연결도 실패해요.
   로컬 DB 사용을 권장해요: pnpm db:setup:local
   staging에 붙어야 한다면: pnpm dev:staging
MSG
fi

# 로컬 PostgreSQL 도달성 확인 (URL이 로컬을 가리킬 때만)
if printf '%s' "$DB_LINE" | grep -qE '@(127\.0\.0\.1|localhost|\[::1\])'; then
  DB_PORT="$(printf '%s' "$DB_LINE" | sed -nE 's#.*@[^:/]+:([0-9]+).*#\1#p')"
  DB_PORT="${DB_PORT:-5432}"
  if ! nc -z 127.0.0.1 "$DB_PORT" >/dev/null 2>&1; then
    cat >&2 <<MSG
❌ 127.0.0.1:${DB_PORT} 의 PostgreSQL에 연결할 수 없어요.
   준비: pnpm db:setup:local
   (이미 준비했다면: brew services start postgresql@15)
MSG
    exit 1
  fi
fi

# wrangler는 assets 디렉터리가 존재해야 실행돼요.
# 이 모드에서는 브라우저가 Vite에서 SPA를 받으므로 dist 내용은 사용되지 않아요.
mkdir -p dist

# ----------------------------------------------------------------- 프로세스
WORKER_PID=""
VITE_PID=""

cleanup() {
  trap - EXIT INT TERM
  [ -n "$VITE_PID" ] && kill "$VITE_PID" 2>/dev/null || true
  [ -n "$WORKER_PID" ] && kill "$WORKER_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "▶ Worker API   http://localhost:${WORKER_PORT}  (/api/*)"
echo "▶ Vite dev     ${BROWSER_ORIGIN}  ← 브라우저는 여기로 접속해요"
echo

# Better Auth의 baseURL/redirect_uri는 브라우저가 보는 origin과 같아야 해요.
# 이 모드에서는 브라우저가 Vite origin을 사용하므로 .dev.vars 값을 덮어써요.
./node_modules/.bin/wrangler dev \
  --port "$WORKER_PORT" \
  --var "BETTER_AUTH_URL:${BROWSER_ORIGIN}" \
  --show-interactive-dev-session=false &
WORKER_PID=$!

for _ in $(seq 1 60); do
  curl -sf -o /dev/null "http://127.0.0.1:${WORKER_PORT}/api/health" && break
  kill -0 "$WORKER_PID" 2>/dev/null || { echo "❌ Worker가 종료됐어요." >&2; exit 1; }
  sleep 1
done

GALANDA_DEV_API_TARGET="http://127.0.0.1:${WORKER_PORT}" \
  ./node_modules/.bin/vite --port "$VITE_PORT" --strictPort "$@" &
VITE_PID=$!

# 둘 중 하나라도 종료되면 전체를 정리해요. (macOS 기본 bash 3.2에는 `wait -n`이 없어요)
while kill -0 "$WORKER_PID" 2>/dev/null && kill -0 "$VITE_PID" 2>/dev/null; do
  sleep 1
done
