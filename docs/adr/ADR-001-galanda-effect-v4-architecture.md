ADR: Galanda Effect v4 Architecture v2

Date: 2026-08-24
Status: Accepted
Scope: Galanda Web/PWA 및 Apps in Toss가 사용하는 서버 애플리케이션 architecture
Supersedes: docs/brainstorms/2026-08-16-galanda-effect-first-architecture-brainstorm.md

1. Context

Galanda는 초기에는 브라우저에서 Effect ManagedRuntime을 실행하고, LocalStorage/Supabase Layer를 교체하는 Effect-first client architecture를 채택했다.

초기 구조는 다음과 같았다.

React
  ↓
TanStack Query
  ↓
ManagedRuntime
  ↓
Effect Use Case
  ↓
LocalStorage / Supabase Layer

그러나 현재 production architecture는 서버 중심으로 전환되었다.

React
  ↓ HTTP
Cloudflare Worker
  ↓
Hono
  ↓
Effect Use Case
  ↓
Context.Service Ports
  ↓
Better Auth / Drizzle
  ↓
PostgreSQL

따라서 기존 문서에 정의된 browser ManagedRuntime, Local/Supabase runtime profile, browser-side repository는 현재 architecture의 source of truth가 아니다. 기존 문서에는 여전히 해당 구조가 confirmed 상태로 남아 있어 현재 구현과 불일치한다.

현재 실제 서버 구현은 Hono route에서 Effect program을 선택하고, repository와 ID generator Layer를 조립한 뒤 runEffect를 통해 request-scoped session 및 request context를 공급하는 구조다.

이 ADR은 이 서버 중심 구조를 공식 architecture로 확정하고 다음 개발 단계인 Confirmed Itinerary lifecycle, multi-user conflict recovery 및 운영 관측성 확장을 위한 경계를 정의한다.

2. Decision

Galanda는 다음 architecture를 채택한다.

┌────────────────────────────────────┐
│ Web / PWA / Apps in Toss           │
│ React + TanStack Query             │
└─────────────────┬──────────────────┘
                  │
                  │ HTTP / JSON
                  ▼
┌────────────────────────────────────┐
│ HTTP Contracts                     │
│ Effect Schema                      │
│ Request / Response / Error DTO     │
└─────────────────┬──────────────────┘
                  ▼
┌────────────────────────────────────┐
│ Hono Transport                     │
│                                    │
│ routing                            │
│ cookies / headers                  │
│ HTTP validation                    │
│ HTTP status mapping                │
└─────────────────┬──────────────────┘
                  │
             Request Layer
                  │
                  ▼
┌────────────────────────────────────┐
│ Effect Application                 │
│                                    │
│ Effect.fn Use Cases                │
│ dependency orchestration           │
│ typed expected failures            │
│ Clock / IdGenerator                │
│ observability                      │
└─────────────────┬──────────────────┘
                  │
        ┌─────────┴──────────┐
        ▼                    ▼
┌──────────────┐      ┌──────────────┐
│ Pure Domain  │      │ Ports        │
│              │      │              │
│ Schema       │      │Context.Service│
│ Brand        │      │              │
│ invariant    │      └──────┬───────┘
│ transition   │             │
│ calculation  │      ┌──────┴─────────┐
└──────────────┘      ▼                ▼
               Better Auth          Drizzle
                 Adapter            Adapter
                                      │
                                  Hyperdrive
                                      │
                                  PostgreSQL

이 구조를 Server-side Effect Application Architecture로 정의한다.

“Effect-first”는 모든 계층을 Effect 라이브러리로 구현한다는 의미가 아니다.

Effect는 Galanda에서 application execution model을 소유한다.

다음 세 가지를 architecture invariant로 고정한다.

- Hono owns transport.
- Effect owns application execution.
- Pure domain rules remain pure.

3. Architecture Ownership

각 기술의 책임은 다음과 같이 고정한다.

영역	소유 기술	책임
UI	React	View / interaction
Server state cache	TanStack Query	cache, stale policy, invalidation
Transport	Hono	routing, HTTP, cookie/header
API contract	Effect Schema	request/response/error validation
Application	Effect	orchestration, dependencies, errors, clock, cancellation
Domain	TypeScript + Effect Schema	invariant, transition, calculation
Authentication protocol	Better Auth	session/OAuth/anonymous auth
Persistence	Drizzle	query, schema, migration, transaction
DB transport	Hyperdrive	Worker↔PostgreSQL connectivity
Database	PostgreSQL	durable state, atomic transaction

다른 영역의 책임을 Effect로 흡수하지 않는다.

특히 다음 전환은 이 ADR에서 채택하지 않는다.

Hono → Effect HttpApi
REST → Effect RPC
Drizzle → Effect SQL
TanStack Query → Effect client state

현재 repository의 vendored Effect에서도 HttpApi/RPC가 unstable namespace이므로 MVP architecture의 핵심 dependency로 추가하지 않는다.

4. Effect Application Boundary

Effect는 다음 문제에 사용한다.

dependency injection
expected failure
asynchronous orchestration
resource lifecycle
Clock / nondeterminism
concurrency coordination
structured observability

Application Use Case는 Effect.fn을 기본 entry point로 사용한다.

현재의:

Effect.fn("createTripRoom")
Effect.fn("createPlan")
Effect.fn("confirmTripPlan")

형태를 유지한다.

Use Case의 기본 책임은 다음과 같다.

resolve actor
→ validate command
→ load aggregate
→ authorize
→ execute domain transition
→ persist result
→ return application result

반대로 외부 I/O가 없는 domain transition에는 Effect를 요구하지 않는다.

예를 들어 다음과 같은 로직은 순수 함수로 유지한다.

confirmPlanInRoom
setPlanOpinionInRoom
deletePlanFromRoom
calculatePlanDifference
getPlanDateRange

Context.Service 또는 Layer를 단순 business rule의 wrapping 용도로 생성하지 않는다.

이는 이미 RAON-170에서 도입한 domain transition / persistence 분리 원칙을 계속 유지하는 결정이다.

5. Effect Services and Layers

외부 dependency 또는 비결정적 capability만 Context.Service로 정의한다.

현재 다음 서비스는 이 기준에 부합한다.

SessionService
TripRoomRepository
InviteRepository
IdGenerator
Database (infrastructure-only)

예를 들어 TripRoomRepository는 이미 Context.Service로 정의되어 있고 repository failure 역시 Effect error channel로 반환된다.

다음 형태는 만들지 않는다.

PlanValidationService
RoomAuthorizationService
TripCalculationService
DomainTransitionService

이러한 로직이 dependency나 resource를 필요로 하지 않는다면 plain domain function이어야 한다.

6. Request-scoped Composition

현재 dependency composition은 일부가 runTripEffect, 일부가 runEffect에 존재한다.

현재:

runTripEffect
 ├─ Database
 ├─ TripRoomRepository
 ├─ InviteRepository
 └─ IdGenerator

runEffect
 ├─ RequestScope
 └─ SessionService

형태다.

v2에서는 이를 하나의 request composition boundary로 수렴시킨다.

Target:

Hono Context
     │
     ├─ requestId
     ├─ database handle
     └─ resolved session
            │
            ▼
      makeRequestLayer
            │
      ┌─────┼───────────────┐
      ▼     ▼               ▼
 Session  Repositories   IdGenerator
      │
      └─────────┬───────────┘
                ▼
          Effect Program

Hono route는 dependency graph를 직접 조립하지 않는다.

Route의 책임은 다음 정도여야 한다.

decode
→ invoke program
→ encode

Production Worker에는 browser 시절의 global ManagedRuntime을 다시 도입하지 않는다.

Session, DB handle 등 request-scoped dependency가 존재하기 때문에 production composition의 자연스러운 lifetime은 HTTP request다.

7. Request Context

Request metadata와 authenticated identity는 별개의 concern으로 취급한다.

RequestContext는 transport-independent correlation metadata만 가진다.

예:

interface RequestContext {
  requestId: string
}

Authenticated actor는 SessionService가 유일한 source of truth다.

따라서 RequestContext와 SessionService 양쪽에서 session을 독립적으로 조회하거나 서로 다른 actor를 보유하게 하지 않는다.

Hono Context 자체는 Core로 전달하지 않는다.

8. HTTP Contract Boundary

현재 frontend API client는 core/usecases의 command와 core/ports의 repository parameter를 직접 타입 dependency로 사용하고 있다. 예를 들어 CreateRoomInput, CreatePlanCommand, UpdateRoomParams, SubmitPlanOpinionInput 등을 직접 import한다.

이 dependency는 v2에서 제거한다.

Target:

src/contracts/
├── common.ts
├── session.ts
├── trip.ts
├── plan.ts
├── invite.ts
├── itinerary.ts
└── error.ts

Contract는 Effect Schema로 작성한다.

예:

CreateTripRequestSchema
CreateTripResponseSchema

PublishPlanRequestSchema
PublishedPlanResponseSchema

ConfirmPlanRequestSchema
ConfirmedItineraryResponseSchema

ApiErrorSchema

의존성 방향은:

React
 ↓
HTTP Contracts
 ↑
Hono

Hono
 ↓ mapping
Application Command
 ↓
Use Case

으로 한다.

HTTP DTO와 Application Command가 우연히 동일한 shape이더라도 같은 type으로 취급하지 않는다.

특히 다음을 금지한다.

HTTP request
  = Repository Params

HTTP request
  = Domain Aggregate

HTTP request
  = UseCase internal command

이를 통해 Domain aggregate의 변경이 API breaking change로 바로 전파되지 않도록 한다.

9. Response Model

HTTP API는 앞으로 전체 TripRoom aggregate를 모든 mutation response로 반환하는 것을 기본값으로 삼지 않는다.

현재 API client는 많은 mutation의 결과로 TripRoomSchema 전체를 decode한다.

새 endpoint부터는 use case에 맞는 response model을 선호한다.

예:

TripSummary
TripDetail
PublishedPlan
ConfirmedItinerary
ItineraryRevision
ItineraryAcknowledgement

Domain entity와 API read model은 필요할 때 분리한다.

단, 기존 API를 architecture 정리를 이유로 한 번에 전면 교체하지 않는다.

새 vertical slice부터 적용한 후 점진적으로 migration한다.

10. Error Algebra

Effect의 typed error channel을 Galanda의 application error contract로 사용한다.

현재는 UnauthorizedError가 authentication과 authorization을 동시에 표현하고 있으며, HTTP adapter에서는 항상 401로 변환된다.

또한 ConflictError는 optimistic concurrency와 domain state conflict 모두에 사용되고 있지만 HTTP에서는 모두 REVISION_CONFLICT가 된다. 현재 confirmTripPlan에서 “이미 확정됨” 역시 ConflictError를 사용한다.

v2에서는 다음 의미를 분리한다.

Error	의미	HTTP
UnauthorizedError	authenticated session 없음	401
ForbiddenError	actor는 존재하지만 권한 없음	403
AccountUpgradeRequiredError	registered account 필요	403
NotFoundError	resource 없음 또는 intentionally concealed	404
InvalidInviteError	invalid/expired/revoked invite	404
ValidationError	semantic validation 실패	422
RevisionConflictError	optimistic CAS 실패	409
StateConflictError	현재 domain state에서 command 수행 불가	409
SessionUnavailableError	authentication dependency 장애	503
RepositoryError	persistence adapter failure (현재 통합 오류)	503

현재 `RepositoryError`는 database availability/SQL failure뿐 아니라 persisted data decode/integrity failure와 server-generated identifier collision도 함께 포함한다. 따라서 현재의 503 mapping은 dependency unavailable만을 뜻하는 완전한 invariant가 아니라 preflight 시점의 limitation이다. 후속 error hardening에서 `RepositoryUnavailableError → 503`과 `PersistenceIntegrityError → 500`으로 분리한다.

RevisionConflictError만 다음 필드를 가진다.

expectedRevision
actualRevision

그리고 frontend conflict recovery는 오직 REVISION_CONFLICT에 대해서만 refetch/reapply flow를 실행한다.

예:

RevisionConflict
→ fetch latest state
→ compare changes
→ preserve local input
→ explicit retry/reapply

반면:

AlreadyConfirmed
→ StateConflict

은 revision recovery 대상으로 취급하지 않는다.

11. Defect vs Expected Failure

Effect failure channel에는 사용자가 실제로 경험할 수 있는 예상 가능한 실패만 둔다.

unauthenticated
forbidden
not found
validation
revision conflict
dependency unavailable

programmer bug, impossible state, invariant violation 등 예상하지 않은 결함은 typed business error로 위장하지 않는다.

Hono boundary는:

Expected Effect Failure
→ defined API error

Defect / unexpected Cause
→ 500 INTERNAL_SERVER_ERROR
→ internal structured log

로 유지한다.

현재 runEffect가 Exit을 받고 HTTP error mapper에서 Cause를 해석하는 구조는 이 원칙에 부합하므로 유지한다.

12. Persistence Boundary

현재 TripRoom aggregate는 PostgreSQL 한 row에 저장된다.

trip_rooms

id
title
destination
revision
members JSONB
plans JSONB
confirmedPlanId

그리고 하나의 revision을 이용해 전체 aggregate CAS를 수행한다.

현재 Plan/Opinion/Room mutation에 대해서는 이 구조를 유지한다.

Architecture 정리를 이유로 기존 aggregate를 전면 정규화하지 않는다.

하지만 Confirmed Itinerary는 별도의 aggregate로 분리한다.

이유는 Itinerary lifecycle 이후 다음 mutation들이 독립적으로 발생하기 때문이다.

Plan edit
Host itinerary edit
Participant A acknowledgement
Participant B acknowledgement

이들을 모두 TripRoom.revision 하나로 제어하면 의미 없는 conflict가 발생한다.

13. Confirmed Itinerary Aggregate

RAON-209부터 target persistence model은 다음과 같다.

trip_rooms
  └─ current room / plan aggregate

confirmed_itineraries
  ├─ id
  ├─ trip_id
  ├─ source_plan_id
  ├─ source_plan_revision
  ├─ current_revision
  ├─ created_by
  └─ created_at

itinerary_revisions
  ├─ itinerary_id
  ├─ revision
  ├─ snapshot JSONB
  ├─ changed_by
  └─ created_at

itinerary_acknowledgements
  ├─ itinerary_id
  ├─ participant_id
  ├─ acknowledged_revision
  └─ acknowledged_at

초기 confirmation은:

Published TripPlan revision N
          │
          ▼
     Host confirms
          │
          ▼
ConfirmedItinerary
 currentRevision = 1
 sourcePlanRevision = N
          │
          ▼
ItineraryRevision 1
 immutable snapshot

이 된다.

원본 Plan을 이후 수정하거나 재공개해도 이미 생성된 Itinerary revision은 변경되지 않는다.

14. Concurrency Boundaries

모든 mutation을 하나의 global Trip revision으로 묶지 않는다.

각 aggregate가 자신의 concurrency token을 가진다.

TripRoom
  → roomRevision

ConfirmedItinerary
  → itineraryRevision

Acknowledgement
  → participant scoped monotonic state
Trip Room

현재 계약을 유지한다.

expectedRoomRevision
→ compare-and-set
→ stale
→ REVISION_CONFLICT
Itinerary

Host edit:

expectedItineraryRevision
→ append new immutable revision
→ update currentRevision

예:

v1
 ↓ HOST edit expected=v1
v2

stale host edit는 itinerary revision conflict가 된다.

Acknowledgement

Ack 자체는 Itinerary revision을 증가시키지 않는다.

participant A → acknowledgedRevision = 2
participant B → acknowledgedRevision = 1

최신 itinerary가 v2라면:

A = acknowledged
B = pending

으로 계산한다.

새 itinerary v3이 생성되면 기존 ack record를 삭제하지 않는다.

A acknowledgedRevision = 2
currentRevision = 3

→ A pending

이 된다.

15. Transaction Policy

Core에 범용 DB transaction abstraction을 만들지 않는다.

금지:

TransactionService.begin()
TransactionService.commit()

또는:

Database.execute(...)

를 Core에서 직접 사용하는 방식.

단일 use case가 여러 persistence state를 atomic하게 저장해야 하는 경우 domain-specific atomic persistence capability를 정의한다.

예를 들어 confirm에서는:

Use Case
 │
 ├─ auth
 ├─ authorization
 ├─ validation
 ├─ build immutable snapshot
 │
 ▼
atomic confirmation persistence

adapter가 하나의 Drizzle transaction에서 다음을 수행한다.

verify expected room revision
+ preserve confirmation state
+ create confirmed itinerary
+ create itinerary revision 1

Repository가 “확정할 수 있는지”를 결정하면 안 된다.

Application/Domain이 정책을 결정한 뒤 Repository는 이미 결정된 상태를 원자적으로 persist하는 역할만 가진다.

16. Domain State Modeling

새로운 domain state를 optional field 조합으로 계속 확장하지 않는다.

현재 TripPlan은:

status
revision?
publishedAt?

을 하나의 Schema 안에서 표현한다.

Itinerary lifecycle에서는 이것을 더 복잡하게 확장하지 않는다.

개념적으로 다음 상태를 분리한다.

Draft
   ↓ publish
PublishedPlan revision N
   ↓ confirm
ConfirmedItinerary revision 1

특히:

TripPlan.status === CONFIRMED

와:

TripRoom.confirmedPlanId

에 이어 세 번째 confirmation source를 추가하지 않는다.

Confirmed Itinerary migration이 끝난 이후 **확정 일정의 source of truth는 ConfirmedItinerary**다.

기존 confirmedPlanId 및 CONFIRMED status는 migration compatibility가 필요한 동안만 유지하고 별도 cleanup에서 제거 여부를 판단한다.

17. Authentication and Authorization

Actor identity는 계속 server session에서만 결정한다.

Better Auth
   ↓ normalize
SessionService
   ↓
Effect Use Case

Client가 전달하는 다음 값은 authorization 근거로 사용하지 않는다.

userId
participantId
role
host
createdBy
changedBy
acknowledgedBy

이러한 server-owned field는 Use Case에서 SessionService를 통해 결정한다.

Stable domain identity는 계속 ParticipantId를 사용한다.

18. Retry Policy

TanStack Query의 자동 retry는 현재처럼 비활성화 상태를 유지한다. 현재 실제 설정도 query와 mutation 모두 retry: false다.

그러나 “Effect가 retry를 담당한다”는 것을 모든 Effect에 자동 retry를 적용한다는 의미로 해석하지 않는다.

Default:

Mutation
→ automatic retry 없음

특히 다음은 자동 retry하지 않는다.

create
confirm
append revision
ack command with side effect
CAS mutation

dependency failure retry가 필요하다면:

idempotent
+
transient
+
bounded

세 조건을 만족하는 operation에 명시적으로 적용한다.

Retry 정책은 adapter 또는 application operation별로 가시적으로 정의한다.

19. Observability

Effect를 사용하는 주요 이유 중 하나로 observability를 포함한다.

모든 주요 Use Case에는 현재와 같이 의미 있는 Effect operation name을 부여한다.

createTripRoom
createPlan
updatePlan
confirmTripPlan
appendItineraryRevision
acknowledgeItinerary

Request boundary에서 최소 다음 correlation context를 생성한다.

requestId
HTTP route
operation

필요한 경우 다음 domain identifier를 추가할 수 있다.

tripId
planId
itineraryId

사용자 이름, 이메일 또는 인증 credential 등 불필요한 개인정보는 log annotation에 넣지 않는다.

Expected business failure와 defect를 다른 severity/structure로 기록한다.

장기적으로 OpenTelemetry exporter를 추가할 수 있지만 observability backend 선택은 이 ADR의 범위가 아니다.

20. Frontend Boundary

Frontend는 Effect runtime을 실행하지 않는다.

Effect를 frontend에서 사용할 수 있는 범위는 shared Schema decoding 같은 순수 contract usage까지다.

즉:

React
  ✕ Effect Use Case
  ✕ Repository
  ✕ SessionService
  ✕ Layer

대신:

React
  ↓
TanStack Query
  ↓
HTTP Client
  ↓
Effect Schema response validation

을 사용한다.

브라우저에는 ManagedRuntime을 다시 만들지 않는다.

21. Directory Target

대규모 directory rename은 하지 않는다.

기존 구조를 유지하면서 최소한 다음 경계만 명확히 한다.

src/
├── app/
│   ├── api-client.ts
│   └── query-client.ts
│
├── contracts/
│   ├── common.ts
│   ├── error.ts
│   ├── session.ts
│   ├── trip.ts
│   ├── plan.ts
│   ├── invite.ts
│   └── itinerary.ts
│
├── core/
│   ├── domain/
│   ├── calculations/
│   ├── ports/
│   └── usecases/
│
└── infrastructure/
    ├── auth/
    └── persistence/

worker/
├── app.ts
├── routes/
├── http/
│   ├── effect-handler.ts
│   ├── effect-validator.ts
│   ├── api-error.ts
│   └── request-layer.ts
└── infrastructure/

core/usecases를 application/으로 rename하지 않는다.

현재 이름 자체보다 dependency direction이 중요하다.

22. Dependency Rules

Target dependency graph은 다음과 같다.

features
   ↓
app/api-client
   ↓
contracts
   ↓
(core/domain — 필요한 shared semantic type에 한함)


worker/routes
   ↓
contracts
   ↓
core/usecases
   ↓
core/domain + core/ports
                   ↑
              infrastructure

다음을 금지한다.

core → Hono
core → Drizzle
core → Better Auth
core → Cloudflare
core → React

frontend → core/usecases
frontend → core/ports

repository → Hono context
repository → React
23. Effect Version Policy

현재 application dependency와 vendored Effect source는 모두:

4.0.0-rc.109

로 일치한다.

Effect version은 exact version으로 고정한다.

RC 기간에는 architecture를 unstable API 위에 새로 구축하지 않는다.

특히 다음은 별도 architecture decision 없이 도입하지 않는다.

effect/unstable/http
effect/unstable/httpapi
effect/unstable/rpc
effect/unstable/persistence

Effect stable 전환 또는 RC upgrade는 현재 코드가 사용하는 API 및 vendored source/test와 함께 검증한다.

이 책임은 기존 Effect dependency 정합성 작업과 분리해 유지한다.

24. Testing Strategy

테스트 계층도 architecture boundary를 따른다.

Pure domain tests
  ↓
Use Case tests with test Layers
  ↓
Repository adapter tests
  ↓
HTTP adapter / contract tests
Domain

Layer 없이 deterministic하게 테스트한다.

Use Case

다음 service를 test Layer로 교체할 수 있어야 한다.

SessionService
Repository
IdGenerator
Clock
Persistence

다음을 검증한다.

Schema decode
CAS
transaction atomicity
revision semantics
HTTP

다음을 검증한다.

request decode
error → status/code
response contract
defect → 500

특히 RevisionConflictError와 StateConflictError가 같은 HTTP code로 collapse되지 않는 regression test를 둔다.

25. Consequences
Positive

Effect가 가장 강한 application orchestration 영역에 집중된다.

Hono, Better Auth, Drizzle을 유지하면서도 business error와 dependency가 typed하게 유지된다.

Frontend와 backend contract가 usecase/repository 내부 타입에서 분리된다.

Confirmed Itinerary가 독립적인 revision lifecycle을 가질 수 있다.

Participant acknowledgement 때문에 Room 전체 CAS가 충돌하지 않는다.

Effect RC의 unstable subsystem에 architecture가 종속되지 않는다.

Negative

HTTP DTO와 Application Command 사이에 일부 mapping code가 추가된다.

Error type migration이 필요하다.

Itinerary부터 persistence table과 repository가 추가된다.

현재 단일 JSONB aggregate보다 transaction design이 복잡해진다.

Accepted trade-off

해당 복잡성은 UI/transport/framework abstraction을 추가하는 것이 아니라 실제로 독립된 lifecycle과 concurrency를 갖게 된 domain을 분리하기 위해 발생하는 복잡성이므로 수용한다.

26. Rejected Alternatives
대안	결정
Browser ManagedRuntime 복원	Rejected
모든 TypeScript logic을 Effect로 wrapping	Rejected
Hono → Effect HttpApi 전환	Rejected
REST → Effect RPC 전환	Rejected
Drizzle → Effect SQL 전환	Rejected
Generic TransactionService Core port	Rejected
Itinerary/Ack까지 TripRoom JSONB 하나에 저장	Rejected
전체 TripRoom schema 즉시 정규화	Rejected
Effect 제거 후 Promise 기반 service로 복귀	Rejected
27. Migration Plan

현재 기능 개발을 멈추고 architecture rewrite를 하지 않는다.

다음 순서로 점진적으로 적용한다.

Phase 1
Architecture source of truth 정리

- 이 ADR 추가
- 기존 2026-08-16 Effect-first 문서 → superseded
- AGENTS.md architecture diagram 수정


Phase 2
Error Algebra

UnauthorizedError
→ authentication 전용으로 유지

authenticated authorization failure
→ ForbiddenError

ConflictError
→ RevisionConflictError / StateConflictError

HTTP mapping + regression tests


Phase 3
HTTP Contracts

src/contracts 추가
frontend의 core/usecases / core/ports import 제거
새 endpoint부터 explicit response DTO 사용


Phase 4
Request Composition

runTripEffect / runEffect dependency composition 통합
request-layer 도입
SessionService를 actor source of truth로 고정


Phase 5
Confirmed Itinerary

Itinerary domain/schema
Itinerary persistence aggregate
initial immutable snapshot
itinerary revision
acknowledgement


Phase 6
Observability

structured request context
Effect operation/span/log correlation


Phase 7
Effect Version

RC compatibility 검토
stable migration 가능 여부 판단
28. Exit Criteria

Architecture v2가 적용됐다고 판단하려면 다음 상태를 만족해야 한다.

Frontend
→ HTTP contract만 사용
→ core usecase/port에 직접 의존하지 않음

Hono
→ transport 책임만 소유

Effect
→ application execution을 소유

Domain
→ pure transition / invariant를 소유

Ports
→ external capability만 표현

Drizzle
→ persistence / transaction을 소유

Authentication failure
!= Authorization failure

Revision conflict
!= Domain state conflict

TripRoom revision
!= Itinerary revision
!= Participant acknowledgement

Confirmed Itinerary
→ source Plan revision에서 immutable하게 생성

Effect unstable HttpApi/RPC
→ MVP critical path에 없음

모든 변경은 기존 canonical gate:

pnpm check

를 통과해야 한다.
