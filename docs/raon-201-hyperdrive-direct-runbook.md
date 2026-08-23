# RAON-201 Hyperdrive Direct PostgreSQL 전환

DB password와 전체 connection URL은 source control, PR, Linear, shell history에 기록하지 않는다.

## 현재 staging 설정

`galanda-staging` Worker의 `HYPERDRIVE` binding은 기존 configuration ID를 유지한다.

```text
origin: db.jxzlxatsaqqpekceludt.supabase.co:5432/postgres
origin user: galanda_worker
TLS: require
query caching: disabled
```

비밀값 없이 현재 상태를 확인한다.

```bash
npx wrangler hyperdrive get 36428926fddb413e82914434280e3ffc
```

출력에서 Direct hostname, port `5432`, `galanda_worker`, TLS `require`, `caching.disabled: true`를 확인한다. `wrangler.jsonc`의 staging binding ID도 같아야 한다.

## 전환

Supabase Dashboard의 Connect 화면에서 Direct hostname을 확인한 뒤 기존 Hyperdrive origin의 host와 port만 갱신한다. 기존 database, runtime role, password, TLS, cache 설정은 유지한다.

```bash
npx wrangler hyperdrive update 36428926fddb413e82914434280e3ffc \
  --origin-host db.<project-ref>.supabase.co \
  --origin-port 5432
```

connection pool을 재시작해 기존 Session Pooler 연결을 drain한 뒤 staging을 재검증한다. 로컬 migration 환경이 IPv4-only이면 migration용 `DATABASE_URL`에만 Supabase Session Pooler를 사용할 수 있다. Worker runtime은 Direct origin을 유지한다.

## 검증

```bash
npm run check
npx wrangler deploy --env staging --dry-run
npx wrangler check startup
```

staging에서 `GET /api/health`, Better Auth sign-up/session/sign-out, Trip create/list/detail/update, Plan create/update/opinion/confirm, second-user join, stale revision `409`, 즉시 read-after-write, SPA deep-link를 확인한다.

## Rollback

1. Supabase Dashboard의 Connect 화면에서 이전 Session Pooler 정보를 확인한다.
2. Cloudflare Dashboard에서 같은 Hyperdrive configuration의 origin을 이전 Session Pooler host, port, user로 되돌리고 runtime password를 대화형으로 입력한다.
3. TLS `require`와 query caching disabled를 유지한다.
4. connection pool을 재시작하고 위 staging smoke를 반복한다.

rollback credential과 전체 connection URL도 문서나 명령 인자에 남기지 않는다.

## 2026-08-23 staging 검증

- Worker version: `e18cf9ff-f8e9-4dd4-8d2d-bd17c423c0c7`
- `npm run check`, staging deploy dry-run, startup check 통과
- Better Auth sign-up/session/sign-out와 secure cookie 속성 확인
- Trip create/list/detail/update, Plan create/update/opinion/confirm, second-user join 통과
- stale revision `409`와 Trip/confirm 직후 fresh read 확인
- `GET /api/health`와 SPA deep-link `200` 확인
