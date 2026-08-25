# Galanda — 친구들과 함께하는 여행 일정 조율

React + TanStack Query 기반 Web/PWA가 기본 타깃이며, Apps in Toss는 선택적 플랫폼 타깃으로 동작해요. 서버는 Hono transport + Effect application + Drizzle/PostgreSQL 경계 위에 구성되어 있어요.

- **Repository guide**: [`AGENTS.md`](./AGENTS.md) — 저장소 경계·아키텍처 invariant·검증 규칙
- **Architecture**: [`docs/adr/ADR-001-galanda-effect-v4-architecture.md`](./docs/adr/ADR-001-galanda-effect-v4-architecture.md) — Hono/Effect/Domain/Ports ownership, error algebra, persistence/concurrency
- **UI**: [`docs/ui-foundation.md`](./docs/ui-foundation.md) — shadcn + Base UI + Tailwind 기준 (과거 TDS는 참고만)
- **Staging**: [`docs/staging-operations-runbook.md`](./docs/staging-operations-runbook.md) — Cloudflare Worker/Hyperdrive/PostgreSQL/Better Auth 운영 절차
- **Hyperdrive/DB role**: [`docs/raon-201-hyperdrive-direct-runbook.md`](./docs/raon-201-hyperdrive-direct-runbook.md), [`docs/raon-204-database-role-runbook.md`](./docs/raon-204-database-role-runbook.md)
- **Effect version**: [`docs/effect-version-decision.md`](./docs/effect-version-decision.md) — 설치 package ↔ vendored source 정합성 및 RC 유지 결정 (현재 `effect@4.0.0-rc.109`)

> `docs/tds-ui-foundation.md`는 과거 UX/정보구조 참고용이며 현 UI 구현의 source of truth가 아니에요.

## 요구 사항

- Node `>=24 <25`, pnpm `>=9` (Corepack `packageManager` 고정: `pnpm@9.15.1`)
- TypeScript `7.0.2` strict, Oxlint type-aware, Vitest + jsdom, Vite 8, Wrangler 4

## Web/PWA (기본)

```bash
pnpm install --frozen-lockfile
pnpm dev              # 일반 브라우저 개발 (Vite)
pnpm build            # typecheck + vite build (Web/PWA) — build:web 동일
pnpm preview          # 빌드 결과 미리보기
```

초기 번들은 route-level lazy loading으로 분리되어 있어요. `/trips`, `plans`, `itinerary` 등 미진입 라우트 코드는 초기 entry에 포함되지 않으며 `pnpm build` 시 별도 chunk로 출력돼요.

UI는 shadcn/ui(Base UI) + Tailwind CSS 기반이에요. 신규 primitive는 `src/components/ui/*`를 경유하고, TDS/Emotion 전면 재작성은 하지 않아요.

## Cloudflare Worker

```bash
pnpm dev:worker        # Web build 후 Worker + Static Assets 로컬 실행
pnpm dev:staging       # staging Hyperdrive를 사용하는 Cloudflare 원격 개발
pnpm deploy:staging    # Web build 후 Cloudflare Workers 배포 (staging)
```

`/api/*`는 Worker가 처리하고, 그 외 경로는 `dist/`의 SPA로 서빙해요.

### Better Auth runtime configuration

Better Auth와 application repository는 같은 request-scoped Drizzle handle을 사용해요. Worker 환경에는 다음 값을 주입해요.

```text
BETTER_AUTH_SECRET      Wrangler secret로 관리하는 32자 이상 high-entropy secret
BETTER_AUTH_URL         환경별 canonical public origin (예: https://galanda.example)
KAKAO_CLIENT_ID         Web/PWA Kakao Login REST API key
KAKAO_CLIENT_SECRET     Kakao Login client secret (사용 시 Wrangler secret)
TOSS_MTLS               Apps-in-Toss 로그인용 Cloudflare mTLS certificate binding
DATABASE_URL            local runtime fallback용 PostgreSQL URL
MIGRATION_DATABASE_URL  Drizzle migration 전용 관리자 PostgreSQL URL
HYPERDRIVE              staging/production Worker의 Cloudflare Hyperdrive binding
```

Auth schema도 Drizzle migration에 포함되므로 DB 반영은 기존 명령을 사용해요.

```bash
pnpm db:generate       # Drizzle schema → migration 생성
pnpm db:migrate        # MIGRATION_DATABASE_URL로 migration 실행
pnpm db:check          # drizzle-kit check
pnpm check:db          # db:check + bash scripts/check-drizzle-drift.sh (DB 없이 drift 검증)
```

Worker runtime DB 접근과 migration credential은 분리되어 있으며, staging/production은 Hyperdrive 경계를 유지해요.

## Apps in Toss (선택적 target)

```bash
pnpm dev:ait           # AIT devtools를 켠 개발 (vite --mode ait)
pnpm build:ait         # typecheck + Web bundle + AIT packaging (vite --mode ait && ait build)
pnpm deploy            # AIT 배포 (ait deploy)
```

플랫폼 설정은 `apps-in-toss.config.ts`에서, AIT SDK 사용은 `src/platform/ait/`에서만 관리해요. 일반 feature 코드는 `@apps-in-toss/*`를 직접 import하지 않고 platform adapter를 경유해요.

## 테스트

```bash
pnpm test              # vitest run — src/**/*.{test,spec}.{ts,tsx}, worker/**/*.{test,spec}.ts, jsdom + @testing-library/react
```

- `src/core/calculations/plan-cost.test.ts` — 확정가/범위/미정, 0원(known zero) 구분 검증
- `src/core/calculations/plan-diff.test.ts` — 도시/숙소/교통 추가·삭제·변경, 비용 차이, 제목 변경, 변경 없음, stable summaryText
- `src/components/ui/badge.test.tsx`, `src/features/common/DecisionStatusBanner.test.tsx` 등 `.tsx` 화면 경계 smoke — jsdom 환경에서 수집됨을 증명
- 새 테스트 의존성(`jsdom`, `@testing-library/react`, `@testing-library/jest-dom`)은 devDependency로만 포함됨 (production bundle 미포함)

## 검증 (CI gate)

Node 24를 사용하며, `main`에 merge하려면 `CI / verify` required check가 통과해야 해요. 로컬·CI 모두 `package.json`의 `check`가 canonical gate예요.

```bash
pnpm lint              # oxlint --disable-nested-config
pnpm test              # vitest run
pnpm check:db          # db:check + drift check (CI는 DATABASE_URL 없이 실행)
pnpm build             # Web/PWA
pnpm build:ait         # AIT
# 또는 전체
pnpm check             # lint && test && check:db && build && build:ait
```

효과적인 검증 순서: `focused unit/domain → use case / repository / HTTP integration → UI/component → full gate`.

## Effect with AI agents

`repos/effect`는 설치된 `effect` package와 동일한 버전의 소스를 vendoring한 읽기 전용 참조예요 (현재 `4.0.0-rc.109`).

- 애플리케이션 코드는 `effect`에서만 import하고, `repos/effect`에서 직접 import하지 않아요.
- `effect/unstable/*` (HttpApi/RPC/Sql)는 MVP critical path가 아니므로 도입하지 않아요 — ADR-001 참고.
- 버전/사용 API 정합성 및 RC 유지 근거는 `docs/effect-version-decision.md`에 문서화되어 있어요.

To upgrade both together:

```bash
pnpm add effect@<version> --save-exact
git subtree pull --prefix=repos/effect https://github.com/Effect-TS/effect.git effect@<version> --squash
```

두 단계를 반드시 같은 버전으로 함께 수행하고 `pnpm check`로 검증해요.
