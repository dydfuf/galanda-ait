# 문서 안내

현재 작업에 필요한 문서만 읽는다. 에이전트의 요청 해석, 승인, 병렬 작업,
진행 보고와 검증 범위는 [AGENTS.md](../AGENTS.md)를 따른다.
과거 문서의 실행 지시나 체크박스가 현재 사용자의 요청을 대신하지 않는다.

## 현재 기준

| 영역 | 먼저 읽을 문서 | 실제 동작을 확인할 곳 |
|---|---|---|
| 시작·명령 | [README](../README.md), [로컬 개발](local-development.md) | [package.json](../package.json), [CI](../.github/workflows/ci.yml) |
| 서버 구조 | [ADR-001](adr/ADR-001-galanda-effect-v4-architecture.md) | `worker/`, `src/core/`, `src/infrastructure/` |
| 여행 생성 제품 계약 | [ADR-002](adr/ADR-002-trip-creation-wizard-product-contract.md) | `src/features/plan-editor/`, `src/app/router.tsx` |
| UI 구현·설계 | [UI foundation](ui-foundation.md), [design.md](../design.md) | `src/components/`, `src/index.css`, UI contract tests |
| 협업·최신성 | [Collaboration contract](collaboration-freshness-contract.md) | query 설정, HTTP mutation, revision conflict 테스트 |
| DB·배포 | [Staging runbook](staging-operations-runbook.md), [Hyperdrive](raon-201-hyperdrive-direct-runbook.md), [DB role](raon-204-database-role-runbook.md) | [drizzle.config.ts](../drizzle.config.ts), Drizzle schema/migrations, Worker 설정 |
| Effect 버전 | [버전 결정](effect-version-decision.md) | `package.json`과 `repos/effect/packages/effect/package.json` |
| 탐색 분류 | [도시](explore-city-taxonomy.md), [테마](explore-theme-taxonomy.md) | `src/core/domain/`, 공개 listing 구현 |
| AI 추천 운영 | [AI Gateway](raon-238-ai-gateway-runbook.md), [Shadow eval 결정](raon-239-shadow-eval-decision.md) | Worker vars, ranking adapter, eval script |

문서의 역할과 실제 코드가 다르면 현재 요청과 실행 가능한 근거를 대조한다.
설명이 오래된 것이 명확하면 갱신한다. 제품 의미나 승인 범위가 불명확한 경우에만
필요한 질문을 한다. 서버 보안·데이터 계약을 과거 UI 설명에 맞춰 되돌리지 않는다.

## 과거 결정과 구현 계획

- [제품 정의](brainstorms/2026-08-14-galanda-group-trip-product-brainstorm.md)와
  [화면 명세](brainstorms/2026-08-14-galanda-screen-flow-brainstorm.md)는 제품 의도와
  화면 선택의 배경이다. 특정 시점의 UI·경로는 현재 ADR·구현과 대조한다.
- [초기 기술 스택](brainstorms/2026-08-16-galanda-technical-stack.md),
  [초기 Effect 구조](brainstorms/2026-08-16-galanda-effect-first-architecture-brainstorm.md),
  [초기 라우팅](brainstorms/2026-08-16-galanda-routing-architecture-brainstorm.md),
  [TDS foundation](tds-ui-foundation.md)는 과거 기준이다.
  browser ManagedRuntime, Supabase client/RLS, TDS를 신규 구현 지시로 적용하지 않는다.
- [PROJECT.md](../PROJECT.md)와 [질문형 wizard 계획](plans/2026-09-02-feat-granular-trip-creation-wizard-plan.md)은
  해당 기능의 구현 이력이다. 당시 미체크 항목을 새 작업 목록으로 취급하지 않는다.
- [RAON-190](raon-190-oxlint-compatibility.md), [RAON-193](raon-193-database-boundary.md)은
  도입 당시 결정이다. 패키지 지원 여부와 DB 운영 명령은 현재 설정에서 확인한다.

## 검증 기록과 보류된 작업

- [design-qa](../design-qa.md): 여행 중심 UI의 로컬 샘플 데이터 기반 시각 검증.
- [MVP matrix](acceptance/2026-08-18-mvp-acceptance-test-matrix.md),
  [UI foundation acceptance](acceptance/ui-foundation-v2.md): 해당 변경의 검증 범위와 판정.
- [Issue #98 AIT 기록](issue-98-ait-webview-verification.md),
  [RAON-292 퍼널 검증](raon-292-decision-funnel-verification.md): 날짜·환경별 실행 증거.
- [UI/UX Review Pack](acceptance/ui-ux-closure/README.md): 화면 inventory, 시나리오,
  finding, 증거 및 UX-02~UX-06 보고서. [관련 todo](../todos/001-ready-p1-ui-ux-closure.md)는
  당시 추적 자료이며 현재 요청의 범위를 정하지 않는다.

기록의 `passed`, 배포 SHA, 테스트 수는 그 실행의 결과다. 현재 checkout·배포·실기기의
통과를 뜻하지 않는다. 미검증·보류·중단 상태를 새 증거 없이 완료로 바꾸거나,
남은 매트릭스 때문에 무관한 작업을 멈추지 않는다. 사용자가 보류한 검증은
관련 작업을 재개하도록 요청받았을 때 범위를 확인한다.

## 문서 변경

현재 기준을 설명하는 문서는 실제 코드·명령과 함께 갱신한다. 과거 결정·검증 기록은
당시의 사실을 유지하고, 대체 문서와 적용 범위를 앞부분에 적는다.
실행 지침은 `AGENTS.md`에 모아 중복과 충돌을 줄인다.

에이전트 지침은 사용자 제공 [GPT-6 Astra prompting guide](https://developers.openai.com/api/docs/guides/latest-model/gpt-6-astra#prompting-best-practices)의
자율 진행, 지침 우선순위, 명확한 보고, 필요한 위임, 변경 규모에 맞는 검증 원칙을
저장소에 맞게 반영한다. 구체적인 작업 규칙은 `AGENTS.md`를 단일 기준으로 유지한다.
