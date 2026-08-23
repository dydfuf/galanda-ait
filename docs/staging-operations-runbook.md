# Cloudflare + Supabase staging 운영 Runbook

이 문서는 `galanda-staging` backend의 재구성, 배포, 검증, rollback 순서를 정한 운영 source of truth다. 실제 secret, password, 전체 database connection URL은 repository, PR, Linear, shell history에 기록하지 않는다.

## Architecture

```text
Better Auth     → authentication/session
Hono + Effect   → server API/application boundary
Drizzle         → persistence mapping/migrations
Hyperdrive      → Worker PostgreSQL connection pooling
Supabase        → PostgreSQL hosting only
```

production application path는 Supabase Auth, `supabase-js`, PostgREST를 사용하지 않는다. Worker runtime의 Better Auth와 repositories는 같은 request-scoped Drizzle handle을 사용한다.

## Configuration contract

### Repository-safe

| 항목 | Source of truth |
| --- | --- |
| Worker entrypoint, compatibility date, `nodejs_compat` | `wrangler.jsonc` |
| `ASSETS`, SPA fallback, `/api/*` Worker 우선 처리 | `wrangler.jsonc` |
| staging `BETTER_AUTH_URL` | `wrangler.jsonc` |
| staging `HYPERDRIVE` binding name과 ID | `wrangler.jsonc` |
| Drizzle schema와 migrations | `src/infrastructure/persistence/drizzle/schema/`, `drizzle/` |

### Secret 또는 control-plane only

| 항목 | 보관 위치 |
| --- | --- |
| `BETTER_AUTH_SECRET` | Cloudflare Worker staging secret |
| PostgreSQL password와 전체 origin connection URL | Cloudflare Hyperdrive / secret manager |
| 관리자용 `DATABASE_URL` | migration 실행 환경에만 일시 주입 |

`DATABASE_URL`은 local runtime fallback과 migration용이다. staging Worker runtime은 `HYPERDRIVE.connectionString`을 사용한다. `VITE_*` database credential은 만들지 않는다.

## Runtime invariants

현재 staging Hyperdrive configuration은 다음 상태를 유지한다.

```text
binding: HYPERDRIVE
id: 36428926fddb413e82914434280e3ffc
origin: Supabase Direct PostgreSQL db.<project-ref>.supabase.co:5432/postgres
origin user: galanda_worker
TLS: require
query caching: disabled
```

query cache를 임의로 다시 켜지 않는다. Better Auth session, authorization/membership, revision/CAS, write 직후 Trip list/detail은 stale read를 허용하지 않는다. cache가 disabled여도 Hyperdrive connection pooling은 유지된다.

TLS `require`는 encrypted connection과 WebPKI server certificate 검증을 유지한다. `sslmode=disable`, 인증서 검증 우회, 평문 연결은 금지한다.

비밀값 없이 실제 설정을 확인한다.

```bash
npx wrangler hyperdrive get 36428926fddb413e82914434280e3ffc
npx wrangler secret list --env staging
```

`hyperdrive get`에서 Direct hostname/port, `galanda_worker`, `sslmode: require`, `caching.disabled: true`를 확인한다. secret 목록에는 `BETTER_AUTH_SECRET` 이름만 있어야 하며 값을 출력하지 않는다.

cache가 활성화된 경우 즉시 다시 끈다.

```bash
npx wrangler hyperdrive update 36428926fddb413e82914434280e3ffc --caching-disabled
```

## Staging bootstrap

### 1. Local quality gate

Node 24에서 실행한다.

```bash
npm ci
npm run check
```

### 2. Supabase와 migration

1. Supabase project와 Direct PostgreSQL endpoint를 Dashboard의 Connect 화면에서 확인한다.
2. Supabase Data API가 disabled인지 확인한다.
3. 관리자 credential을 shell history에 남기지 않고 일시적으로 주입한다.
4. migration과 최소 권한 검증을 실행한다.

```bash
printf 'DATABASE_URL: ' >&2
IFS= read -r -s DATABASE_URL
printf '\n' >&2
export DATABASE_URL
(
  npm run db:migrate &&
    psql "$DATABASE_URL" -f scripts/verify-database-privileges.sql
)
unset DATABASE_URL
```

Direct endpoint는 기본적으로 IPv6다. 실행 환경이 IPv4-only이고 Supabase IPv4 add-on이 없다면 migration용 `DATABASE_URL`에만 Session Pooler port `5432`를 사용할 수 있다. Worker Hyperdrive origin은 Direct endpoint를 유지한다.

runtime role의 생성·권한·credential 적용은 [RAON-204 database role rollout](./raon-204-database-role-runbook.md)을 따른다.

### 3. Hyperdrive

새 환경이면 Cloudflare Dashboard에서 Supabase Direct endpoint와 `galanda_worker` credential로 Hyperdrive를 만든다. password 또는 전체 URL을 CLI argument로 넘기지 않는다.

다음 상태를 확인한 뒤 `wrangler.jsonc`의 staging binding ID를 실제 configuration ID와 맞춘다.

- origin: Direct PostgreSQL port `5432`
- TLS: `require` 이상
- query caching: disabled
- binding name: `HYPERDRIVE`

기존 origin 전환과 rollback 세부 절차는 [RAON-201 Hyperdrive Direct PostgreSQL 전환](./raon-201-hyperdrive-direct-runbook.md)을 따른다.

origin이나 credential 변경 뒤 기존 연결을 즉시 drain해야 할 때만, staging traffic이 없는 시점에 Cloudflare Dashboard의 Hyperdrive → Settings → Danger zone → Restart를 사용한다. restart 중 in-flight query는 잠깐 실패할 수 있다.

### 4. Better Auth

canonical staging origin은 `wrangler.jsonc`의 `BETTER_AUTH_URL`과 일치해야 한다. secret은 대화형으로 등록한다.

```bash
npx wrangler secret put BETTER_AUTH_SECRET --env staging
npx wrangler secret list --env staging
```

secret rotation은 기존 session을 무효화할 수 있으므로 배포 직후 sign-up/session/sign-out을 다시 확인한다.

### 5. Types, deploy, remote smoke

```bash
npm run types:worker
npm run typecheck
npx wrangler deploy --env staging --dry-run
npm run deploy:staging
```

배포 출력에서 `ASSETS`, `HYPERDRIVE`, `BETTER_AUTH_URL` binding과 version ID를 기록하되 secret 값은 기록하지 않는다.

## Remote smoke checklist

- `GET /api/health` → `200`
- SPA deep-link와 emitted asset → `200`
- 존재하지 않는 `/api/*` → JSON `404`이며 SPA fallback이 아님
- anonymous `GET /api/auth/get-session` → 정상적인 null session
- Better Auth sign-up → session → sign-out
- auth cookie → `HttpOnly`, `Secure`, `SameSite=Lax`
- Trip create → 즉시 list/detail에서 최신 값 확인 → update
- Plan create → update → opinion → confirm
- second-user join 후 membership/authorization 즉시 반영
- stale revision mutation → `409 REVISION_CONFLICT`
- mutation 직후 list/detail/session read가 stale data를 반환하지 않음
- browser deep-link 렌더링과 console/page error 확인

canonical `Origin` header 없이 auth mutation이 `MISSING_OR_NULL_ORIGIN`으로 거부되는 것은 정상 보안 동작이다. 정상 smoke mutation은 `BETTER_AUTH_URL`과 같은 Origin을 사용한다.

## Rollback과 incident 대응

### Hyperdrive origin 변경 실패

검증 전 기존 configuration을 삭제하지 않는다. Cloudflare Dashboard에서 직전 origin host/port/user와 credential로 되돌리고 TLS와 cache-disabled 상태를 유지한다. 즉시 drain이 필요할 때만 pool을 restart한 뒤 전체 remote smoke를 반복한다.

### Query cache 재활성화 / stale read

`hyperdrive get`으로 상태를 확인하고 `--caching-disabled`로 복구한다. Trip create 직후 list/detail, session, membership, stale revision `409`를 다시 확인한다.

### Migration 실패

Worker 배포를 중단하고 실패한 migration과 현재 schema를 먼저 확인한다. migration을 무작정 재실행하거나 자동 rollback하지 않는다. 데이터 복구가 필요하면 승인된 backup/restore 절차를 사용하고, schema와 application compatibility를 확인한 뒤 배포한다.

### `BETTER_AUTH_SECRET` 누락 또는 잘못된 rotation

secret 이름을 확인하고 직전 값을 secret manager에서 대화형으로 복원한다. 값을 복구할 수 없으면 새 값으로 rotation하고 기존 session 무효화를 수용한 뒤 auth smoke를 수행한다.

### Worker deploy 후 auth/API 장애

먼저 Hyperdrive, secret 이름, canonical origin, migration 상태를 확인한다. code/config regression이면 직전 정상 version ID로 rollback한다.

```bash
printf 'Stable Worker version ID: ' >&2
IFS= read -r STABLE_VERSION_ID
npx wrangler rollback "$STABLE_VERSION_ID" --env staging --message "staging incident rollback"
unset STABLE_VERSION_ID
```

Worker rollback은 database migration을 되돌리지 않는다. 이전 Worker가 현재 schema와 호환되는지 확인하지 못했다면 rollback 대신 forward fix를 선택한다.

## References

- [Cloudflare Hyperdrive query caching](https://developers.cloudflare.com/hyperdrive/concepts/query-caching/)
- [Cloudflare Hyperdrive TLS/SSL certificates](https://developers.cloudflare.com/hyperdrive/configuration/tls-ssl-certificates-for-hyperdrive/)
- [Cloudflare Hyperdrive connection pooling](https://developers.cloudflare.com/hyperdrive/concepts/connection-pooling/)
- [Cloudflare Workers rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)
- [Supabase PostgreSQL connections](https://supabase.com/docs/guides/database/connecting-to-postgres)
