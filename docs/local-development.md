# 로컬 개발 환경

Web/PWA 기본 타깃을 로컬에서 **로그인까지 동작하는 상태**로 실행하는 방법이에요.

## 왜 예전에는 로그인이 안 됐나요

두 가지가 겹쳐 있었어요.

1. **`pnpm dev`가 Vite dev server만 띄웠어요.** `/api/*`는 Worker(Hono)가 소유하는데
   Vite dev server에는 proxy가 없었어요. 그래서 `POST /api/auth/sign-in/social`이
   SPA fallback HTML을 받고 `response.json()`에서 깨졌어요.
   production에서는 Cloudflare assets의 `run_worker_first: ["/api/*"]`가 이 역할을 해요.
2. **로컬 Worker의 `DATABASE_URL`이 Supabase Direct endpoint를 가리켰어요.**
   Direct endpoint(`db.<project-ref>.supabase.co`)는 AAAA 레코드만 있는 IPv6 전용이에요.
   IPv6 egress가 없는 로컬 네트워크에서는 TCP 연결 자체가 실패하고,
   그 결과 `/api/session`은 503 `AUTH_SERVICE_UNAVAILABLE`이 돼요.

로컬 Worker는 `HYPERDRIVE` 바인딩 없이 실행되므로
`worker/infrastructure/database/database-live.ts`의
`env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL` 폴백을 사용해요.
staging/production Worker runtime은 그대로 Hyperdrive 경계를 유지해요.

## 구성

```text
브라우저 (http://localhost:5173)
   │
   ├── /            SPA + HMR            → Vite dev server
   └── /api/*       proxy                → wrangler dev (http://localhost:8787)
                                              │
                                              └── DATABASE_URL → 로컬 PostgreSQL
                                                    galanda_worker @ galanda_local
```

로컬 DB도 staging의 권한 경계를 그대로 재현해요.

| 역할 | role | 권한 |
| --- | --- | --- |
| migration / admin | `postgres` | schema 소유, DDL |
| Worker runtime | `galanda_worker` | allowlist된 테이블의 DML만 |

덕분에 **새 테이블에 `GRANT`를 누락한 migration은 staging이 아니라 로컬에서 먼저 실패해요.**

## 최초 1회 세팅

### 1. PostgreSQL 설치

```bash
brew install postgresql@15
```

Homebrew 기본 설정은 로컬 접속에 `trust` 인증을 사용하므로 **비밀번호가 없어요.**
로컬 DB 자격증명을 새로 만들거나 저장할 필요가 없어요.

### 2. 로컬 DB 준비

```bash
pnpm db:setup:local
```

이 스크립트(`scripts/setup-local-db.sh`)는 idempotent하고, 다음을 수행해요.

1. PostgreSQL이 꺼져 있으면 시작해요.
2. `postgres`(admin)와 Supabase 호환 role(`anon`, `authenticated`, `service_role`)을 만들어요.
   migration 0002·0003·0004가 이 role들의 권한을 `REVOKE`하므로 로컬에도 존재해야 해요.
   전부 `NOLOGIN`이고 어떤 권한도 갖지 않아요.
3. `galanda_local` database를 만들어요.
4. Drizzle migration을 적용해요.
5. `galanda_worker`의 `LOGIN`을 켜요 (staging의 RAON-204 절차와 동일).
6. `scripts/verify-database-privileges.sql`로 권한 계약을 검증해요.

### 3. `.dev.vars` 설정

`wrangler dev`가 이 파일에서 secret을 읽어요. 커밋되지 않아요(`.gitignore`).

```dotenv
BETTER_AUTH_SECRET="<32자 이상 임의 문자열 — 로컬 전용>"
BETTER_AUTH_URL="http://localhost:8787"
DATABASE_URL="postgresql://galanda_worker@127.0.0.1:5432/galanda_local"
MIGRATION_DATABASE_URL="postgresql://postgres@127.0.0.1:5432/galanda_local"
KAKAO_CLIENT_ID="<Kakao REST API key>"
KAKAO_CLIENT_SECRET="<Kakao client secret>"
```

- `BETTER_AUTH_SECRET`이 없으면 `makeBetterAuth`가 throw해서 `/api/auth/*`가 500이 돼요.
- `KAKAO_CLIENT_ID`가 없으면 social provider가 등록되지 않아 카카오 로그인만 실패해요
  (익명 로그인과 나머지 API는 정상 동작해요).
- `BETTER_AUTH_URL`은 `pnpm dev:worker`용 값이에요. `pnpm dev`는 브라우저 origin이
  Vite쪽이므로 `--var`로 `http://localhost:5173`을 주입해서 덮어써요.

## 매일 쓰는 명령

```bash
pnpm dev          # Worker API(8787) + Vite dev(5173) 동시 실행 → http://localhost:5173
```

| 명령 | 용도 | API |
| --- | --- | --- |
| `pnpm dev` | 기본 로컬 개발 (HMR + API) | 로컬 Worker |
| `pnpm dev:ait` | 같은 스택을 AIT 모드로 | 로컬 Worker |
| `pnpm dev:vite` | SPA만 (UI 전용 작업) | ❌ 없음 — 로그인 불가 |
| `pnpm dev:worker` | 빌드된 SPA + Worker를 8787 한 origin에서 | 로컬 Worker |
| `pnpm dev:staging` | Cloudflare 원격 실행 (staging Hyperdrive/DB) | staging |

포트를 바꾸려면:

```bash
GALANDA_DEV_VITE_PORT=5200 GALANDA_DEV_WORKER_PORT=8800 pnpm dev
```

## 카카오 로그인을 로컬에서 쓰려면

OAuth redirect URI는 Kakao 개발자 콘솔에 **미리 등록된 값만** 허용돼요.
Better Auth는 `BETTER_AUTH_URL`을 기준으로 redirect URI를 만들기 때문에,
사용하는 모드에 맞는 값을 등록해야 해요.

| 실행 모드 | 등록할 Redirect URI |
| --- | --- |
| `pnpm dev` | `http://localhost:5173/api/auth/callback/kakao` |
| `pnpm dev:worker` | `http://localhost:8787/api/auth/callback/kakao` |

등록 전에는 카카오 인증 화면에서 redirect URI 오류가 나요. Worker 로그가 아니라
카카오 쪽에서 막는 것이므로 로그에는 아무것도 남지 않아요.

등록 여부와 무관하게, 로그인 이후의 서버 경로는 익명 로그인으로 확인할 수 있어요.

```bash
curl -s -X POST http://localhost:5173/api/auth/sign-in/anonymous \
  -H 'content-type: application/json' -d '{}' -c /tmp/galanda-jar.txt
curl -s http://localhost:5173/api/session -b /tmp/galanda-jar.txt
```

두 번째 응답에 `"accountType":"GUEST"`, `"isAuthenticated":true`가 나오면
Worker ↔ Better Auth ↔ 로컬 DB 경로가 정상이에요.

> 게스트 세션으로 `POST /api/trips`를 호출하면 403 `ACCOUNT_UPGRADE_REQUIRED`가 나와요.
> 버그가 아니라 도메인 규칙이에요 — 여행 생성은 `REGISTERED` 계정만 가능해요.

## Migration

`.dev.vars`의 `MIGRATION_DATABASE_URL`이 로컬 DB를 가리키므로 기본 대상은 로컬이에요.

```bash
pnpm db:generate      # schema 변경 → migration 파일 생성
pnpm db:migrate       # 로컬 DB에 적용
pnpm check:db         # drizzle-kit check + drift 검증 (DB 불필요)
```

새 테이블을 추가했다면 같은 migration에
`GRANT SELECT, INSERT, UPDATE, DELETE ... TO galanda_worker`를 반드시 포함해야 해요.
`galanda_worker`에는 default privilege가 없어요.
누락하면 `pnpm db:setup:local`의 권한 검증 단계에서 실패해요.

staging에 적용할 때는 `MIGRATION_DATABASE_URL`을 명시적으로 주입해요
(`docs/staging-operations-runbook.md` 참고). 환경 변수가 `.dev.vars` 값보다 우선해요.

```bash
MIGRATION_DATABASE_URL="<staging 관리자 URL>" pnpm db:migrate
```

## 로컬 DB 초기화

```bash
psql postgresql://postgres@127.0.0.1:5432/postgres \
  -c 'DROP DATABASE IF EXISTS galanda_local'
pnpm db:setup:local
```

## 문제 해결

**`/api/*`가 HTML을 반환해요**
Worker가 안 떠 있어요. `pnpm dev:vite`는 API를 제공하지 않아요. `pnpm dev`를 사용해요.

**`/api/session`이 503 `AUTH_SERVICE_UNAVAILABLE`**
Worker가 DB에 연결하지 못했어요. `DATABASE_URL`이 로컬을 가리키는지,
PostgreSQL이 떠 있는지 확인해요.

```bash
pg_isready -h 127.0.0.1 -p 5432
brew services start postgresql@15
```

**`/api/auth/*`가 500**
`BETTER_AUTH_SECRET`이 비어 있을 때가 가장 많아요.

**카카오 로그인 후 8787로 튕겨요**
`BETTER_AUTH_URL`과 브라우저 origin이 다를 때예요. `pnpm dev`는 자동으로 맞춰줘요.

**포트가 이미 사용 중이에요**
`pnpm dev`는 `--strictPort`를 사용해서 조용히 다른 포트로 옮기지 않아요.
포트가 바뀌면 Better Auth origin이 어긋나기 때문이에요.
`GALANDA_DEV_VITE_PORT` / `GALANDA_DEV_WORKER_PORT`로 바꿔요.

**`pnpm typecheck`이 `Types at worker-configuration.d.ts are out of date`로 실패해요**
`wrangler types`는 기본적으로 로컬 `.dev.vars`의 키를 Env 타입에 포함하므로,
생성 결과가 개발자마다 달라져요. `typecheck` / `types:worker`는 빈
`wrangler-types.env`를 `--env-file`로 지정해서 타입을 `wrangler.jsonc`만으로
결정적으로 생성해요. 이 파일을 지우거나 스크립트에서 플래그를 빼면 문제가 다시 생겨요.

**Supabase Direct endpoint에 붙고 싶어요**
로컬 네트워크에 IPv6 egress가 없으면 불가능해요. 확인:

```bash
dig +short AAAA db.<project-ref>.supabase.co   # 값이 나옴 (IPv6 전용)
dig +short A    db.<project-ref>.supabase.co   # 비어 있음
```

staging DB로 개발해야 한다면 `DATABASE_URL`을 돌려 놓지 말고 `pnpm dev:staging`을 사용해요.
자격증명이 Cloudflare에 남고 Hyperdrive 경계가 유지돼요.
