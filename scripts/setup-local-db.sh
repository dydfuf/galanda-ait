#!/usr/bin/env bash
set -euo pipefail

# 로컬 개발용 PostgreSQL을 준비해요.
#
# staging/production Worker runtime은 Hyperdrive → Supabase Direct 경계를 유지하고,
# 이 스크립트는 그 경계를 건드리지 않아요. 로컬 Worker는
# `worker/infrastructure/database/database-live.ts`의
# `env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL` 폴백을 사용해요.
#
# staging의 권한 경계를 로컬에서도 재현해요.
#   - migration/admin: 관리자 role(기본 `postgres`)
#   - Worker runtime: 최소권한 `galanda_worker` (allowlist된 테이블 DML만)
# 따라서 새 테이블에 GRANT를 누락한 migration은 staging이 아니라 로컬에서 먼저 실패해요.
#
# 로컬 PostgreSQL은 Homebrew 기본값인 `trust` 인증을 사용하므로 password가 없어요.
# 이 스크립트는 어떤 secret도 만들거나 저장하지 않아요.
#
# 사용법:
#   bash scripts/setup-local-db.sh          # 또는 pnpm db:setup:local
#
# 환경 변수로 재정의할 수 있어요:
#   GALANDA_LOCAL_PGHOST    (기본 127.0.0.1)
#   GALANDA_LOCAL_PGPORT    (기본 5432)
#   GALANDA_LOCAL_DB        (기본 galanda_local)
#   GALANDA_LOCAL_SUPERUSER (기본 $USER — 서버를 만든 bootstrap superuser)

cd "$(dirname "${BASH_SOURCE[0]}")/.."

HOST="${GALANDA_LOCAL_PGHOST:-127.0.0.1}"
PORT="${GALANDA_LOCAL_PGPORT:-5432}"
DB_NAME="${GALANDA_LOCAL_DB:-galanda_local}"
SUPERUSER="${GALANDA_LOCAL_SUPERUSER:-${USER}}"

# migration이 `ALTER DEFAULT PRIVILEGES FOR ROLE postgres`를 사용하므로 admin role 이름은 고정이에요.
ADMIN_ROLE="postgres"
RUNTIME_ROLE="galanda_worker"

if ! [[ "$DB_NAME" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
  echo "❌ GALANDA_LOCAL_DB는 SQL identifier여야 해요: $DB_NAME" >&2
  exit 1
fi

# ---------------------------------------------------------------- psql 확인
if ! command -v psql >/dev/null 2>&1; then
  for candidate in /opt/homebrew/opt/postgresql@15/bin /usr/local/opt/postgresql@15/bin \
                   /opt/homebrew/opt/postgresql@14/bin /usr/local/opt/postgresql@14/bin; do
    if [ -x "$candidate/psql" ]; then
      PATH="$candidate:$PATH"
      export PATH
      break
    fi
  done
fi

if ! command -v psql >/dev/null 2>&1; then
  cat >&2 <<'MSG'
❌ psql을 찾을 수 없어요.
   설치: brew install postgresql@15
   PATH: export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"
MSG
  exit 1
fi

# --------------------------------------------------------- 서버 기동 확인
if ! pg_isready -h "$HOST" -p "$PORT" -q 2>/dev/null; then
  echo "▶ PostgreSQL이 $HOST:$PORT 에서 응답하지 않아요. 시작을 시도해요…"
  if command -v brew >/dev/null 2>&1; then
    for formula in postgresql@15 postgresql@14; do
      if brew list --versions "$formula" >/dev/null 2>&1; then
        brew services start "$formula" >/dev/null 2>&1 || true
        break
      fi
    done
  fi

  for _ in $(seq 1 30); do
    pg_isready -h "$HOST" -p "$PORT" -q 2>/dev/null && break
    sleep 1
  done
fi

if ! pg_isready -h "$HOST" -p "$PORT" -q 2>/dev/null; then
  cat >&2 <<MSG
❌ $HOST:$PORT 의 PostgreSQL에 연결할 수 없어요.
   수동 시작: brew services start postgresql@15
MSG
  exit 1
fi

BOOTSTRAP_URL="postgresql://${SUPERUSER}@${HOST}:${PORT}/postgres"

if ! psql "$BOOTSTRAP_URL" -tAc 'select 1' >/dev/null 2>&1; then
  cat >&2 <<MSG
❌ '${SUPERUSER}' 로 로컬 PostgreSQL에 연결할 수 없어요.
   GALANDA_LOCAL_SUPERUSER 로 서버의 superuser 이름을 지정해 주세요.
MSG
  exit 1
fi

# ----------------------------------------------------------------- role 생성
# `anon`/`authenticated`/`service_role`은 Supabase가 제공하는 role이에요.
# migration 0002/0003/0004가 이 role들의 권한을 REVOKE하므로 로컬에도 존재해야 해요.
# 여기서 만드는 role은 전부 NOLOGIN이고 어떤 권한도 갖지 않아요.
echo "▶ role 준비: ${ADMIN_ROLE}, anon, authenticated, service_role"
psql "$BOOTSTRAP_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
		CREATE ROLE postgres SUPERUSER LOGIN;
	END IF;

	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
		CREATE ROLE anon NOLOGIN;
	END IF;

	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
		CREATE ROLE authenticated NOLOGIN;
	END IF;

	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
		CREATE ROLE service_role NOLOGIN;
	END IF;
END
$$;
SQL

# ------------------------------------------------------------- database 생성
if psql "$BOOTSTRAP_URL" -tAc "select 1 from pg_database where datname = '${DB_NAME}'" | grep -q 1; then
  echo "▶ database '${DB_NAME}' 이미 존재해요"
else
  echo "▶ database '${DB_NAME}' 생성"
  psql "$BOOTSTRAP_URL" -v ON_ERROR_STOP=1 -q \
    -c "CREATE DATABASE \"${DB_NAME}\" OWNER ${ADMIN_ROLE}"
fi

ADMIN_URL="postgresql://${ADMIN_ROLE}@${HOST}:${PORT}/${DB_NAME}"
RUNTIME_URL="postgresql://${RUNTIME_ROLE}@${HOST}:${PORT}/${DB_NAME}"

# ------------------------------------------------------------------ migration
# `--env-file-if-exists`는 이미 설정된 환경 변수를 덮어쓰지 않으므로,
# 여기서 준 로컬 URL이 .dev.vars의 staging 값보다 우선해요.
echo "▶ drizzle migration 적용 → ${DB_NAME}"
MIGRATION_DATABASE_URL="$ADMIN_URL" \
  node ./node_modules/drizzle-kit/bin.cjs migrate

# --------------------------------------------------- runtime role 로그인 허용
# migration 0002는 `galanda_worker`를 NOLOGIN으로 만들어요.
# staging에서도 RAON-204 절차에서 LOGIN을 별도로 켜요(관리 속성은 부여하지 않아요).
echo "▶ runtime role '${RUNTIME_ROLE}' 로그인 허용"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
ALTER ROLE galanda_worker LOGIN;
SQL

# ---------------------------------------------------------------- 권한 검증
echo "▶ 권한 계약 검증 (scripts/verify-database-privileges.sql)"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q -f scripts/verify-database-privileges.sql

# ------------------------------------------------- runtime 연결 실제 확인
echo "▶ runtime role로 실제 연결 확인"
psql "$RUNTIME_URL" -v ON_ERROR_STOP=1 -tAc 'select count(*) from public."user"' >/dev/null

cat <<MSG

✅ 로컬 DB 준비 완료

  database        ${DB_NAME}
  admin/migration ${ADMIN_URL}
  Worker runtime  ${RUNTIME_URL}

.dev.vars 에 다음 값을 넣어 주세요 (이미 있다면 확인만):

  DATABASE_URL="${RUNTIME_URL}"
  MIGRATION_DATABASE_URL="${ADMIN_URL}"

이후 로컬 실행:

  pnpm dev:local   # Worker API(8787) + Vite dev(5173) 동시 실행
MSG
