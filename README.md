# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

# galanda

## Web/PWA (기본)

```bash
pnpm dev        # 일반 브라우저 개발
pnpm build      # Web/PWA production build (= build:web)
```

UI는 shadcn/ui(Base UI) + Tailwind CSS 기반이에요. 규칙은 `docs/ui-foundation.md`를 참고해요.

## Cloudflare Worker

```bash
pnpm dev:worker       # Web build 후 Worker + Static Assets 로컬 실행
pnpm dev:staging      # staging Hyperdrive를 사용하는 Cloudflare 원격 개발
pnpm deploy:staging  # Web build 후 Cloudflare Workers 배포
```

`/api/*`는 Worker가 처리하고, 그 외 경로는 `dist/`의 SPA로 서빙해요.

staging bootstrap, migration, deploy, smoke, rollback 절차는 [Cloudflare + Supabase staging 운영 Runbook](docs/staging-operations-runbook.md)을 참고해요.

### Better Auth runtime configuration

Better Auth와 application repository는 같은 request-scoped Drizzle handle을
사용해요. Worker 환경에는 다음 값을 주입해요.

```text
BETTER_AUTH_SECRET  Wrangler secret로 관리하는 32자 이상 high-entropy secret
BETTER_AUTH_URL     환경별 canonical public origin (예: https://galanda.example)
KAKAO_CLIENT_ID     Web/PWA Kakao Login REST API key
KAKAO_CLIENT_SECRET Kakao Login client secret (사용 시 Wrangler secret)
TOSS_MTLS           Apps-in-Toss 로그인용 Cloudflare mTLS certificate binding
DATABASE_URL        local runtime fallback용 PostgreSQL URL
MIGRATION_DATABASE_URL Drizzle migration 전용 관리자 PostgreSQL URL
HYPERDRIVE          staging/production Worker의 Cloudflare Hyperdrive binding
```

Auth schema도 Drizzle migration에 포함되므로 DB 반영은 기존 명령을 사용해요.

```bash
pnpm db:migrate
```

## Apps in Toss (선택적 target)

```bash
pnpm dev:ait    # AIT devtools를 켠 개발
pnpm build:ait  # Web bundle + AIT packaging
pnpm deploy
```

플랫폼 설정은 `apps-in-toss.config.ts`에서, AIT SDK 사용은 `src/platform/ait/`에서 관리해요.
일반 feature 코드는 `@apps-in-toss/*`를 직접 import하지 않아요.

## CI

Node 24를 사용하며, `main`에 merge하려면 `CI / verify` required check가 통과해야 해요.
PR은 최신 `main`과 동기화된 상태에서 아래 명령을 모두 통과해야 해요.

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm db:check
bash scripts/check-drizzle-drift.sh # Drizzle migration drift check (no DB required)
pnpm build
pnpm build:ait
```

`pnpm check:db`는 `db:check`와 drift check를 함께 실행해요. CI는 `db:migrate`를 실행하지 않으며 `DATABASE_URL`/`BETTER_AUTH_SECRET` 등 DB credential이 필요 없어요.

## Effect with AI agents

`repos/effect` vendors the source matching the installed `effect` package so coding agents can follow real Effect patterns. Application code imports from `effect`, never from `repos/effect`.

To upgrade both together:

```bash
pnpm add effect@<version> --save-exact
git subtree pull --prefix=repos/effect https://github.com/Effect-TS/effect.git effect@<version> --squash
```
