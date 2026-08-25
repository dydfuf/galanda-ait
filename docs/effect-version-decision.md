# Effect 4 RC Version Decision (RAON-131) — 2026-08-26

## 현재 상태 (2026-08-26 검증)

- `package.json`: `effect@4.0.0-rc.109` (exact)
- `repos/effect/packages/effect/package.json`: `4.0.0-rc.109`
- `pnpm` exact 고정, `repos/effect`는 `git subtree`로 동일 태그에서 vendored

두 소스는 동일한 release를 가리키며, mismatch는 존재하지 않는다.

## 사용 API 호환성

현재 코드에서 사용하는 Effect API:

- `Effect`, `Effect.fn`, `Effect.gen`, `Effect.succeed/fail`, `Cause`, `Exit`, `Layer`, `Context.Service`, `Option`, `Result`
- `Schema` (Struct, String, Array, Literals, Brand, filter, decode)
- `Clock`

모두 `4.0.0-rc.109` stable namespace에 속하며, `effect/unstable/*` (HttpApi, Rpc, Sql, Http) 미사용.

`repos/effect`의 동일 버전 소스와 테스트를 대조해도 API 시그니처가 일치한다.

- `Effect.fn` 의 제네릭 시그니처
- `Schema.Struct` / `Schema.Literals` / `Schema.makeFilter`
- `Context.Service` / `Layer.succeed` / `Layer.merge`

ADR-001이 이미 확정한 아키텍처 소유 관계(Hono transport / Effect application / Drizzle persistence)는 vendor 버전에 영향받지 않는다.

## 결정: rc.109 유지

### 이유
- package ↔ vendored source 정합성이 이미 확보되어 추가 migration이 불필요하다.
- 상위 RC 또는 stable GA가 MVP 필수 기능을 바꾸지 않는다. 현재 RC는 strict/Oxlint/typecheck 및 모든 use-case 테스트를 통과한다.
- 업그레이드는 `repos/effect` subtree 재동기와 전체 `pnpm check` 재검증이 필요해 MVP scope 대비 비용만 증가한다.
- 불안정 영역(HttpApi/RPC/SQL)을 이유로 아키텍처를 확장하지 않는 ADR-001 원칙을 유지한다.

### 다음 트리거
다음 중 하나가 발생하면 재평가한다:

1. Effect 4 stable GA 릴리즈 (또는 보안/치명적 버그 패치 RC)
2. 현재 사용 API에 breaking change가 공지된 RC
3. MVP 이후 선택적 upgrade window (예: Phase 7)

upgrade 시 절차는 `README.md > Effect with AI agents` 절을 따른다:

```bash
pnpm add effect@<version> --save-exact
git subtree pull --prefix=repos/effect https://github.com/Effect-TS/effect.git effect@<version> --squash
```

두 단계를 반드시 같은 버전으로 함께 수행하고, `pnpm check`로 검증한다.

## 검증

- `pnpm test` / `pnpm lint` / `pnpm typecheck` / `pnpm build` / `pnpm build:ait` 모두 통과 (2026-08-26)
- `grep -R "effect/unstable"` 결과 없음 — unstable 의존성 없음 확인
