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
| `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET` | Cloudflare Worker staging secret |
| `TOSS_MTLS` certificate와 private key | Cloudflare mTLS certificate binding |
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

## Request correlation과 log privacy

Worker는 모든 응답에 `x-request-id`를 반환한다. upstream ID는 영문자, 숫자,
`.`, `_`, `:`, `-`로만 구성된 128자 이하 값만 보존하며, 그 외에는 새 UUID를
발급한다.

Cloudflare invocation log는 실제 URL에 invite token 같은 path capability를 남길
수 있으므로 `wrangler.jsonc`에서 비활성화한다. 대신 API 요청마다
`http_request_completed` 구조화 로그를 한 건 기록한다. 이 로그에는 request ID,
method, 실제 parameter 값이 제거된 route template, status, duration만 포함한다.
query, cookie, authorization header, 사용자 이름/email은 추가하지 않는다.

비밀값 없이 실제 설정을 확인한다.

```bash
npx wrangler hyperdrive get 36428926fddb413e82914434280e3ffc
npx wrangler secret list --env staging
```

`hyperdrive get`에서 Direct hostname/port, `galanda_worker`, `sslmode: require`, `caching.disabled: true`를 확인한다. Web/PWA staging secret 목록에는 `BETTER_AUTH_SECRET`, `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET` 이름이 있어야 하며 값을 출력하지 않는다.

cache가 활성화된 경우 즉시 다시 끈다.

```bash
npx wrangler hyperdrive update 36428926fddb413e82914434280e3ffc --caching-disabled
```

## Staging bootstrap

### 1. Local quality gate

Node 24에서 실행한다.

```bash
pnpm install --frozen-lockfile
pnpm check
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
  pnpm db:migrate &&
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

secret rotation은 기존 session을 무효화할 수 있으므로 배포 직후 login/session/sign-out을 다시 확인한다.

Web/PWA의 기본 로그인은 Kakao Login이다. Kakao Developers에 callback URL
`<BETTER_AUTH_URL>/api/auth/callback/kakao`를 등록하고 값을 대화형으로 넣는다.

```bash
npx wrangler secret put KAKAO_CLIENT_ID --env staging
npx wrangler secret put KAKAO_CLIENT_SECRET --env staging
```

Apps-in-Toss는 Toss Login mTLS 인증서를 Cloudflare에 업로드하고 `TOSS_MTLS`
binding으로 연결한다. 인증서 ID는 환경별 값이므로 실제 ID가 발급된 뒤
`wrangler.jsonc`의 staging `mtls_certificates`에 기록한다. 토스 access token과 사용자
프로필은 저장하지 않고 `userKey`만 Better Auth account 식별자로 사용한다.

#### Staging 이메일 테스트 계정

`wrangler.jsonc`의 `env.staging.vars.APP_ENV = "staging"`일 때만 Better Auth의
이메일·비밀번호 가입과 로그인이 활성화된다. 기본 환경과 production에서는
`APP_ENV`를 생략하거나 해당 환경 이름으로 설정한다. 클라이언트 설정이나 URL로
인증을 활성화할 수 없으며, staging 외 환경에서는 API를 직접 호출해도 거부된다.

Web/PWA `/login`에서 `Staging 테스트 계정` → `테스트 계정 만들기`를 선택하고
테스트용 이름, 이메일, 비밀번호(8~128자)를 입력한다. 가입하면 바로 로그인되며,
이후에는 같은 이메일·비밀번호로 로그인할 수 있다. 로그인 후 원래 요청한
앱 경로로 돌아가고 기존 session/Participant 권한 체계를 그대로 사용한다.
Apps-in-Toss 로그인 화면에는 이메일 폼을 표시하지 않는다.

이메일 소유 확인이나 메일 발송은 하지 않는다. 테스트 전용 주소와 비밀번호를
사용하고 실제 서비스 계정의 비밀번호를 재사용하지 않는다. 비밀번호와 인증 쿠키를
소스, 명령 인자, 로그, PR에 기록하지 않는다. 별도 DB migration이나 메일 서비스는 필요 없다.

`GET /api/auth/config`는 DB 연결 없이 `{ "emailAndPassword": true }`를 반환하며
`Cache-Control: no-store`를 사용한다. staging 외 환경에서는 `false`다.
브라우저도 이 응답을 확인한 뒤 폼을 표시한다. 설정 조회 실패 시에는 숨긴다.

에이전트가 재사용하는 계정은 다음과 같다.

| 항목 | 값 |
| --- | --- |
| 이메일 | `agent-ui@staging.galanda.invalid` |
| 표시 이름 | `Galanda 테스트 에이전트` |
| 대상 origin | `https://galanda-staging.88dydfuf.workers.dev` |
| 자격 증명 파일 | `~/.config/galanda/staging-test-account.json` |
| 파일 필드 | `origin`, `email`, `name`, `password` |
| 파일 권한 | `0600` (저장소 밖, 같은 호스트의 worktree에서 공유) |

이 계정은 staging Hyperdrive를 사용하는 임시 원격 개발 세션에서 생성하고
가입 → 로그아웃 → 저장된 비밀번호로 재로그인 → `/api/session`의 `REGISTERED`
응답까지 확인했다. 공개 staging 로그인은 이메일 로그인 코드가 배포된 뒤 가능하다.

에이전트는 파일을 프로세스 내부에서 읽고 `origin`이 위 staging 주소인지 확인한 후
`/login`의 이메일·비밀번호 폼에 값을 전달한다. 비밀번호나 세션 응답 전체를
출력하지 않는다. HTTP 로그인 시에는 `POST /api/auth/sign-in/email`에 JSON으로
`email`, `password`를 전달하고 같은 origin의 `Origin` 헤더와 쿠키를 사용한다.
로그인 검증은 `/api/session`의 `isAuthenticated: true`, `accountType: "REGISTERED"`와
실제 로그인 후 화면으로 확인한다. 서버 API 성공만으로 브라우저 검증을 완료했다고 기록하지 않는다.

파일이 없는 다른 호스트에서는 안전하게 파일을 전달받아 같은 경로에 `0600`으로
저장한다. 공유 계정 비밀번호를 재설정하거나 이 계정을 로컬/production에 복제하지 않는다.
다른 에이전트의 데이터와 계정 설정은 유지하고, 자신이 만든 테스트 데이터만 정리한다.

### 5. Types, deploy, remote smoke

```bash
pnpm types:worker
pnpm typecheck
npx wrangler deploy --env staging --dry-run
pnpm deploy:staging
```

배포 출력에서 `ASSETS`, `HYPERDRIVE`, `BETTER_AUTH_URL` binding과 version ID를 기록하되 secret 값은 기록하지 않는다.

## Remote smoke checklist

- `GET /api/health` → `200`
- SPA deep-link와 emitted asset → `200`
- 존재하지 않는 `/api/*` → JSON `404`이며 SPA fallback이 아님
- anonymous `GET /api/auth/get-session` → 정상적인 null session
- anonymous Guest → Kakao 또는 Toss 계정 연결 → 동일 Participant 유지 → sign-out
- staging 이메일 가입 → `/api/session`의 `REGISTERED` 확인 → sign-out → 재로그인
- 잘못된 이메일 비밀번호 → 로그인 거부, staging 외 이메일 가입·로그인 → 거부
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
