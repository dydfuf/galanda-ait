# Galanda Agent Guide

이 문서는 Galanda 저장소에서 작업하는 코딩 에이전트가 항상 따라야 하는
저장소 수준의 지침이다.

`AGENTS.md`는 전체 설계 문서나 특정 작업의 구현 지시서가 아니다.
안정적으로 유지되어야 하는 repository map, architecture invariant,
작업 및 검증 규칙만 기록한다.

특정 기능의 요구사항과 완료 조건은 해당 task/goal 및 Linear issue를 따른다.


## 1. 작업을 시작하기 전에

코드를 수정하기 전에 다음 순서로 현재 상태를 확인한다.

1. 현재 파일에 적용되는 `AGENTS.md` / `AGENTS.override.md`를 읽는다.
2. 작업이 Linear issue를 참조한다면 child issue와 parent goal의 최신 내용을 읽는다.
3. 현재 `main`의 관련 코드와 테스트를 직접 확인한다.
4. 관련 repository 문서를 읽는다.
5. `package.json`, config, schema처럼 실행 가능한 source of truth를 확인한다.
6. 필요한 경우 최근 관련 PR의 결정과 변경 이유를 확인한다.

오래된 issue, 문서, 구현이 서로 충돌할 수 있다는 것을 전제로 한다.

- acceptance criteria는 원하는 제품 상태를 설명한다.
- 현재 코드와 테스트는 실제 현재 동작을 설명한다.
- config/schema/scripts는 실행 가능한 계약을 설명한다.

충돌을 발견하면 한쪽을 추측으로 선택하지 않는다.
현재 의도를 확인한 뒤 구현과 문서/issue의 정합성을 함께 복구한다.


## 2. Repository map

주요 경계는 다음과 같다.

- `src/core/domain/`
  - 핵심 domain model과 domain rule
- `src/core/usecases/`
  - application use case
- `src/core/ports/`
  - 외부 의존성을 추상화하는 port
- `src/core/calculations/`
  - 순수 계산 로직

- `src/infrastructure/`
  - auth, persistence 등 외부 시스템 adapter

- `worker/`
  - Cloudflare Worker composition
  - Hono HTTP boundary
  - route 및 Worker-specific infrastructure

- `src/features/`
  - 사용자 기능 단위 UI/application integration

- `src/components/ui/`
  - shadcn/Base UI 기반 공통 primitive
- `src/components/galanda/`
  - Galanda 제품 공통 composition

- `src/platform/`
  - 플랫폼 abstraction
- `src/platform/ait/`
  - Apps-in-Toss 전용 구현

- `src/infrastructure/persistence/drizzle/schema/`
  - application database schema
- `drizzle/`
  - committed database migrations

- `docs/`
  - architecture, UX, acceptance, operation 관련 상세 문서

- `repos/`
  - dependency 확인을 위한 vendored read-only source


## 3. 먼저 읽어야 하는 문서

작업 범위에 해당하면 다음 문서를 우선 확인한다.

### UI

`docs/ui-foundation.md`

현재 UI 구현 기준은 shadcn + Base UI + Tailwind다.

`docs/tds-ui-foundation.md`는 과거 UX/정보구조의 참고 자료일 수 있지만
현재 implementation layer의 source of truth가 아니다.

### Staging / infrastructure

`docs/staging-operations-runbook.md`

Cloudflare Worker, Hyperdrive, PostgreSQL, Better Auth와 관련된 staging 작업은
runbook을 따른다.

Hyperdrive origin이나 database role 변경 시 추가로 다음을 확인한다.

- `docs/raon-201-hyperdrive-direct-runbook.md`
- `docs/raon-204-database-role-runbook.md`

문서와 현재 config/script가 충돌하면 실행 가능한 현재 설정을 확인하고
stale 문서를 함께 갱신한다.


## 4. Architecture invariants

기존 architecture를 우선한다.
기능 하나를 구현하기 위해 병렬 architecture를 만들지 않는다.

현재 기본 구성은 다음과 같다.

```text
Web/PWA / Apps in Toss
        ↓
React feature layer
        ↓
core use cases / domain
        ↓
ports
        ↓
infrastructure adapters
        ↓
Hono + Effect / Drizzle / external systems
````

### Core

`src/core`는 provider-neutral 상태를 유지한다.

다음 구현 세부사항을 core domain/use case에 직접 의존시키지 않는다.

* React
* Hono Context
* Better Auth implementation type
* Drizzle query object
* Cloudflare binding
* Apps-in-Toss SDK

외부 시스템과의 연결은 port/adapter 경계를 우선 사용한다.

## 5. Authentication과 authorization

보안 판단은 서버가 소유한다.

* actor identity는 server session에서 결정한다.
* client가 보낸 `userId`, `participantId`, `role`을 권한의 근거로 신뢰하지 않는다.
* Galanda domain identity는 stable `ParticipantId`를 사용한다.
* 인증 provider의 user identity와 domain participant identity를 동일시하지 않는다.
* private Trip 정보는 server-side membership 확인 후 반환한다.
* UI에서 버튼이나 route를 숨기는 것은 authorization boundary가 아니다.
* 기존 host/member/plan ownership domain rule을 재사용한다.

인증 실패, 권한 실패, validation 실패, dependency 장애,
revision conflict의 의미를 임의로 합치지 않는다.

## 6. Persistence와 concurrency

Trip aggregate mutation은 기존 optimistic concurrency 계약을 유지한다.

```text
expectedRevision
→ atomic compare-and-swap
→ stale write: 409 REVISION_CONFLICT
```

read-modify-write 방식으로 CAS를 우회하지 않는다.

여러 persistence write가 하나의 domain transition을 구성하면
partial state가 남지 않도록 transaction 또는 동등한 atomicity를 명시한다.

## 7. Database

DB schema의 source of truth는 Drizzle이다.

Database 변경은 기본적으로 다음 흐름을 따른다.

```text
Drizzle schema 변경
→ migration 생성
→ 생성된 migration 검토
→ 관련 테스트
→ schema/drift 검증
```

다음을 지킨다.

* ad-hoc production SQL을 application schema의 source of truth로 만들지 않는다.
* migration에는 `MIGRATION_DATABASE_URL`을 사용한다.
* Worker runtime DB access와 migration credential을 분리한다.
* staging/production Worker runtime은 기존 Hyperdrive 경계를 유지한다.
* Supabase는 PostgreSQL hosting으로 사용하며 browser Supabase runtime을 다시 도입하지 않는다.
* Worker database role의 권한을 기능 구현 편의를 위해 확대하지 않는다.

## 8. HTTP / Effect boundary

새 endpoint나 mutation은 기존 Hono ↔ Effect 경계를 따른다.

* request DTO를 명시적으로 정의한다.
* server-owned field를 client input에서 신뢰하지 않는다.
* boundary에서 입력을 validation한다.
* 기존 typed application error contract를 재사용한다.
* 예상하지 못한 defect의 내부 세부사항을 public response에 노출하지 않는다.

전체 entity를 mutation payload로 받기보다 의도가 명확한 command/DTO를 선호한다.

## 9. Frontend와 UI

Web/PWA가 기본 product target이다.
Apps in Toss는 추가 platform target이다.

Apps-in-Toss SDK import는 `src/platform/ait/**`에 격리한다.
일반 feature/UI에서는 platform adapter를 사용한다.

새 UI는 `docs/ui-foundation.md`를 따른다.

특히:

* 신규 primitive는 `src/components/ui/*`를 우선 사용한다.
* 앱 코드에서 Base UI를 직접 사용하기보다 project-owned UI primitive를 경유한다.
* TDS를 다시 도입하지 않는다.
* 기존 Emotion 코드를 이유 없이 Tailwind로 전면 재작성하지 않는다.
* semantic token을 사용하고 신규 raw color를 불필요하게 추가하지 않는다.

UI는 실제 시스템 상태와 다른 성공 상태를 만들어내지 않는다.

예:

* 저장 실패를 `저장됨`으로 표시하지 않는다.
* unknown price를 `0원`으로 표현하지 않는다.
* 입력하지 않은 데이터를 example/default entity로 생성하지 않는다.
* stale data를 최신 데이터처럼 표시하지 않는다.

## 10. Effect와 vendored source

`repos/`는 읽기 전용 참조 자료다.

* `repos/`를 application code에서 import하지 않는다.
* `repos/` 아래 source를 직접 수정하지 않는다.

`effect`를 사용하는 코드를 작성하거나 변경할 때는
`repos/effect/packages/effect/`의 관련 implementation과 test를 확인한다.

단, vendored source가 실제 설치된 `effect` package version과 같은지 먼저 검증한다.
버전이 다르면 vendored source를 현재 API의 근거로 사용하지 않는다.

Effect를 upgrade할 때는 다음 정합성을 함께 유지한다.

* `package.json`의 exact package version
* vendored Effect source
* application에서 사용하는 Effect API
* typecheck/test 결과

## 11. 구현 원칙

작고 검토 가능한 변경을 선호한다.

* 기존 abstraction과 convention을 먼저 찾는다.
* unrelated refactor를 기능 구현에 섞지 않는다.
* 기존 stack으로 해결 가능한 문제에 새 dependency를 추가하지 않는다.
* speculative abstraction을 만들지 않는다.
* 오류를 숨기기 위한 fallback이나 fake data를 추가하지 않는다.
* 이미 해결된 문제를 오래된 issue 설명 때문에 다시 구현하지 않는다.

관련 없는 문제를 발견했으면 현재 작업을 불필요하게 확장하지 않는다.
필요하면 별도 follow-up으로 기록한다.

## 12. 테스트와 검증

변경하기 전에 관련 테스트가 어디에 있는지 먼저 찾는다.

변경 후에는 가장 좁은 검증부터 실행한다.

```text
focused unit/domain test
→ use case / repository / HTTP integration test
→ UI/component test
→ full repository gate
```

bug fix는 가능하면 실패를 재현하는 regression test를 추가한다.

authorization, persistence, concurrency 같은 중요한 계약을
UI test만으로 검증하지 않는다.

코드 변경을 완료하기 전에 현재 repository의 canonical gate를 실행한다.

```bash
npm run check
```

현재 command 이름과 세부 단계는 항상 `package.json`을 source of truth로 사용한다.

required check를 통과시키기 위해:

* test를 제거하거나 무력화하지 않는다.
* CI gate를 약화하지 않는다.
* `continue-on-error`로 바꾸지 않는다.

환경이나 권한 문제로 일부 검증을 실행할 수 없다면
실행하지 못한 항목과 이유를 최종 결과에 명확히 기록한다.

## 13. Toolchain

현재 repository toolchain을 따른다.

* Node 24
* npm / `package-lock.json`
* TypeScript strict configuration
* Oxlint
* Vitest
* Vite
* Wrangler

다른 package manager의 lockfile을 추가하지 않는다.

## 14. Git / PR

기본 단위는 하나의 reviewable change다.

가능하면:

```text
1 Linear child issue
→ 1 coherent implementation
→ focused tests
→ full relevant checks
→ 1 PR
```

관련 없는 작업을 같은 PR에 섞지 않는다.

두 이슈가 동일한 schema/transaction/domain transition 때문에
분리하는 것이 오히려 부자연스러운 경우에만 하나의 PR로 묶는다.

그 경우 PR에 이유를 남긴다.

branch protection이나 required CI를 우회하지 않는다.

## 15. Linear와 Goal 작업

작업이 Linear issue를 기반으로 하고 접근 가능한 경우
실제 코드 상태와 Linear 상태를 일치시킨다.

작업 시작 시:

* 관련 issue와 parent goal을 읽는다.
* 이미 구현된 acceptance criterion이 있는지 확인한다.

작업 중:

* issue가 현재 코드와 맞지 않으면 stale scope를 갱신한다.
* 중요한 architecture/product decision을 기록한다.

완료 시:

* acceptance criteria를 검증한다.
* 관련 PR과 검증 결과를 연결한다.
* 검증이 끝난 뒤 child issue를 Done 처리한다.

코드를 작성했다는 이유만으로 issue를 Done 처리하지 않는다.

parent Goal은 child issue 상태만 보고 완료하지 않는다.
Goal에 정의된 end-to-end exit criteria가 실제로 검증되어야 한다.

## 16. 장기 Goal 실행

여러 issue를 포함하는 장기 Goal에서는 먼저 dependency 순서를 파악한 뒤
작은 단위로 계속 실행한다.

각 단위마다 다음 loop를 반복한다.

```text
inspect
→ plan
→ implement
→ focused test
→ relevant full checks
→ inspect diff
→ update PR / Linear
→ next unit
```

계획만 작성하고 작업을 종료하지 않는다.

Goal의 성공 여부는 변경한 파일 수나 Done issue 수가 아니라
사용자가 관찰할 수 있는 end-to-end behavior로 판단한다.

## 17. 사람이 판단해야 하는 경우

일반적인 구현 선택은 현재 코드, architecture, acceptance criteria를 근거로
자율적으로 결정한다.

다음 경우에는 사람의 판단 또는 승인이 필요하다.

* acceptance criteria의 제품 의미를 변경해야 하는 경우
* destructive production migration
* authorization/security guarantee를 약화해야 하는 경우
* 새로운 외부 서비스 또는 근본적으로 다른 architecture가 필요한 경우
* 필요한 production credential/control-plane access가 없어 핵심 작업을 진행할 수 없는 경우

block될 경우 다음을 명확히 남긴다.

1. 정확한 blocker
2. 이미 완료한 작업
3. 필요한 최소 결정 또는 접근 권한
4. 권장 선택지와 그 이유

## 18. Secret과 capability

다음을 source code, log, PR, Linear comment에 기록하지 않는다.

* database password 또는 전체 private connection URL
* OAuth client secret
* auth/session/access token
* raw bearer capability 또는 invite token
* certificate private key

실제 secret을 테스트 fixture로 복사하지 않는다.
