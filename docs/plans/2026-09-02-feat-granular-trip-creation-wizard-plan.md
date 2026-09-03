---
title: "feat: 여행 만들기 위자드 질문 단위 세분화"
type: feat
date: 2026-09-02
---

# 여행 만들기 위자드 질문 단위 세분화 구현 계획

## 1. 목표

현재의 연속 생성 흐름은 유지하되, 한 화면에서 여러 값을 받는 첫 여행안 편집 화면을 **한 번에 하나의 결정만 받는 질문 흐름**으로 바꾼다.

```text
메인 위자드
1. 여행방 만들기
2. 동행자 초대
3. 첫 여행안 작성
4. 검토 및 등록

첫 여행안 서브 위자드
기본 정보 → 여행 경로 → 숙소 → 교통
```

이번 변경은 첫 여행안을 만드는 최초 여정에만 적용한다. 기존 여행안 추가·수정·복제 화면은 지금의 섹션 편집 UI를 유지한다.

## 2. 현재 구현에서 재사용할 것

- `TripCreatePage`의 여행방 생성 및 이름 검증
- `TripCompanionSetupPage`의 호스트 권한, 공유, 건너뛰기
- `PlanCreatePage`의 첫 여행안 판별, 섹션 이동, 등록 mutation, revision 처리
- `usePlanEditorState`의 폼 데이터, 사용자별 로컬 초안, 자동 저장, 충돌 처리
- `getPlanPublishValidationErrors`와 `resolveEligibleTripActions`의 도메인 검증 및 다음 행동 우선순위
- `PageHeader`, `PageTitle`, `Input`, `RadioGroup`, `BottomAction` 등 현재 UI primitive
- 기존 섹션 URL과 Trip Room 히스토리 앵커

새 전역 위자드 프레임워크, Context/Provider, reducer, 서버 API, DB schema, dependency는 추가하지 않는다.

## 3. 확정할 동작

### 3.1 질문 흐름

| 메인 단계 | 질문 순서 | 필수 여부 | 저장 값 |
|---|---|---:|---|
| 여행방 | 여행방 이름 | 필수 | 기존 room name |
| 동행자 | 초대 링크 공유 여부 | 선택 | 서버 데이터 변경 없음 |
| 기본 정보 | 여행안 제목 → 제안 이유 → 예상 인원 | 제목·인원 필수 | `title`, `proposalReason`, `baseHeadcount` |
| 여행 경로 | 도시 → 도착일 → 출발일 → 도시 추가 여부 | 필수 | `routes[index]` |
| 숙소 | 정함/찾는 중 → 숙소명(정함일 때) | 구간별 필수 | `accommodations[index]` |
| 교통 | 출발지/도착지(필요할 때) → 확인 상태 → 교통수단/소요시간(확인 전이 아닐 때) | 구간별 필수 | `transports[index]` |
| 검토 | 전체 요약 → 수정 또는 등록 | 필수 | 기존 create-plan command |

첫 생성에서는 등록 가능한 최소 정보만 질문한다. 가격, 예약 링크, 환승 여부 같은 선택 정보는 생성 후 기존 편집 화면에서 추가한다.

### 3.2 반복 구간

- 경로는 `도시 → 도착일 → 출발일 → 도시 추가 여부`를 도시 수만큼 반복한다.
- 동일 도시 재방문은 유효하다. 도시명 중복 오류를 새로 만들지 않는다.
- 도시 일정은 겹치면 막지만, 도시 사이의 날짜 공백은 허용한다.
- 숙소는 경로의 각 방문 구간별로 한 번씩 질문한다. 도시명이 같아도 방문 구간은 별개다.
- 교통은 `경로 수 + 1`개 구간을 만든다.
  - 첫 이동의 출발지는 사용자가 입력하고 도착지는 첫 도시에서 제안한다.
  - 도시 간 이동은 인접 경로에서 출발지·도착지를 제안한다.
  - 마지막 이동의 출발지는 마지막 도시에서 제안하고 귀환 도착지는 사용자가 입력한다.
- 제안 값은 사용자가 수정할 수 있으며, 서버 도메인 규칙으로 강제하지 않는다.

### 3.3 미정 상태

- 제안 이유는 `건너뛰기`로 빈 값을 유지할 수 있다.
- 숙소 `찾는 중`은 `isSearching: true`, 빈 `hotelName`, `bookingStatus: "NOT_CHECKED"`로 저장한다.
- 교통 `확인 전`은 출발지·도착지만 저장하고 `mode`, `durationText`는 비워 둔다.
- 입력하지 않은 가격이나 링크를 `0원` 또는 예시 데이터로 채우지 않는다.
- 제목, 인원, 최소 한 개 경로는 미정으로 넘길 수 없다.

### 3.4 뒤로가기와 종료

- 서브 질문 사이 이동은 `replace`를 사용해 기존 Trip Room 히스토리 앵커를 보존한다.
- 화면 안 `이전` 버튼은 직전 질문으로 이동한다.
- Web 브라우저 및 Apps-in-Toss 시스템 뒤로가기는 현재 계약대로 위자드를 닫고 Trip Room 앵커로 돌아간다.
- 시스템 뒤로가기를 질문별 이동으로 바꾸기 위한 새 플랫폼 API는 이번 범위에 포함하지 않는다.

### 3.5 협업 중 상태 변경

- 작성 중 다른 참여자가 첫 여행안을 먼저 등록해도 현재 초안을 버리거나 강제 리다이렉트하지 않는다.
- 현재 작성은 `대안 여행안`으로 계속 등록할 수 있다.
- 방이 확정되면 기존 규칙대로 등록을 막고, 초안은 로컬에 보존한다.
- 네트워크 실패와 revision conflict에서도 현재 질문과 입력값을 유지한다.

## 4. 컴포넌트 단위 계획

### 4.1 기존 컴포넌트 수정

| 파일 | 변경 내용 |
|---|---|
| `src/components/galanda/trip-creation-progress.tsx` | 7개 평면 단계를 `여행방 / 동행자 / 첫 여행안 / 검토` 4개 메인 단계로 변경하고, 현재 서브 단계 설명을 선택적으로 표시한다. |
| `src/features/trip-create/TripCreatePage.tsx` | 기존 한 입력 화면을 유지하고 4단계 진행 표시만 연결한다. 생성 및 history anchor 로직은 변경하지 않는다. |
| `src/features/trip-setup/TripCompanionSetupPage.tsx` | 진행 표시와 다음 CTA 문구를 정리한다. 호스트 전용 공유 및 건너뛰기 동작은 유지한다. |
| `src/features/plan-editor/PlanCreatePage.tsx` | 최초 생성일 때만 질문 위자드를 렌더링하고, 기존 추가·수정·복제는 현재 섹션 편집기를 그대로 렌더링한다. URL cursor 정규화, 다음/이전, 검토 점프, 등록 후 이동을 조정한다. |
| `src/features/plan-editor/components/PlanEditorSections.tsx` | 검토 화면의 항목별 수정 링크가 해당 섹션 첫 화면이 아니라 정확한 미완료 질문을 열도록 연결한다. 기존 요약 UI와 도메인 검증은 재사용한다. |
| `src/features/plan-home/PlanHomePage.tsx` | 사용자 소유의 첫 여행안 초안 cursor가 있으면 `첫 여행안 만들기`를 `이어서 작성하기`로 바꾸고 저장된 질문으로 이동한다. |

### 4.2 새 컴포넌트

파일 수를 늘리지 않기 위해 질문 렌더러는 한 파일에 둔다.

`src/features/plan-editor/components/FirstPlanWizard.tsx`

- 공통 질문 shell: 메인 진행 표시, 질문 제목/설명, 입력 영역, 저장 상태, 하단 `이전/다음`
- `BasicQuestions`: 제목, 제안 이유, 인원
- `RouteQuestions`: 도시, 도착일, 출발일, 도시 추가 여부
- `AccommodationQuestions`: 구간 상태, 숙소명
- `TransportQuestions`: 조건부 endpoint, 확인 상태, 교통수단, 소요시간
- 질문이 바뀌면 제목 또는 입력 요소로 focus 이동
- validation 오류는 해당 입력과 연결된 `aria-describedby` 및 `aria-live` 영역으로 안내
- `BottomAction`을 사용해 모바일 safe-area와 Apps-in-Toss 하단 inset을 유지

각 질문 컴포넌트는 폼 전체 상태를 소유하지 않는다. 현재 값과 `onChange`, `onNext`, `onPrevious`만 받는다.

## 5. 상태 단위 계획

### 5.1 순수 흐름 모델

새 파일 `src/features/plan-editor/first-plan-wizard-flow.ts`에 다음만 둔다.

```ts
type FirstPlanWizardCursor = {
  section: "basic" | "route" | "accommodation" | "transport" | "review";
  question: string;
  index?: number;
};
```

- URL query를 cursor로 파싱하고 유효하지 않은 값은 가장 가까운 유효 질문으로 정규화
- 현재 폼 상태에 따른 첫 질문, 다음 질문, 이전 질문 계산
- 반복 구간의 유효 index 계산
- 도메인 validation 결과를 최초 수정 질문으로 매핑
- route/accommodation/transport 개수에 따라 조건부 질문을 생략

흐름 모듈은 React, router, localStorage를 import하지 않는 순수 함수로 유지한다.

### 5.2 기존 편집 상태 확장

`src/features/plan-editor/hooks/usePlanEditorState.ts`

- 기존 `StoredPlanEditorDraft`에 optional `wizardCursor`만 추가한다.
- 기존 cursor 없는 초안은 그대로 읽을 수 있도록 backward-compatible parser를 유지한다.
- 최초 생성 초안에만 cursor를 저장하고, 기존 edit/clone draft 형식은 바꾸지 않는다.
- 폼 값과 cursor를 같은 사용자·방·draft target 아래 저장한다.
- 저장 실패 시 `ERROR` 상태와 입력값을 유지한다.
- route 변경 시 기존 accommodation sync helper를 재사용한다.
- transport endpoint는 경로에서 제안하되 사용자가 입력한 값을 자동 삭제하지 않는다.

별도 store, reducer, 상태 머신 라이브러리는 만들지 않는다. 폼 값은 계속 `usePlanEditorState`, 현재 위치는 URL cursor가 기준이다.

### 5.3 최초 여정 식별

최초 여정 여부는 단순히 `room.plans.length === 0`만으로 판단하지 않는다.

```text
location.state.tripCreationWizard
또는
현재 사용자 초안의 wizardCursor 존재
또는
계획이 아직 없고 /plans/new/*로 최초 진입
```

이 조건을 사용해 다른 참여자가 먼저 계획을 등록한 경우에도 현재 초안을 대안 계획으로 이어간다. 추천 API에는 더 이상 `FIRST_PLAN` 추천을 요청하지 않고, 등록 CTA만 `대안 여행안 등록하기`로 바꾼다.

## 6. 라우팅 단위 계획

### 6.1 유지할 경로

```text
/trips/new
/trips/:tripRoomId/setup/companions
/trips/:tripRoomId/plans/new/basic
/trips/:tripRoomId/plans/new/route
/trips/:tripRoomId/plans/new/accommodation
/trips/:tripRoomId/plans/new/transport
/trips/:tripRoomId/plans/new
```

질문마다 top-level route를 추가하지 않는다. 기존 section route에 query cursor만 추가한다.

예시:

```text
/plans/new/basic?question=title
/plans/new/route?question=arrival-date&index=0
/plans/new/accommodation?question=status&index=1
/plans/new/transport?question=mode&index=2
/plans/new                     # 검토
```

### 6.2 이동 규칙

- `다음`: 현재 질문 저장·검증 → 순수 flow resolver로 다음 cursor 계산 → `replace`
- `이전`: 순수 flow resolver로 이전 cursor 계산 → `replace`
- `건너뛰기`: 허용된 unknown 값 명시 → 다음 cursor로 `replace`
- 검토의 `수정`: 해당 항목의 첫 오류 cursor로 이동하고 `returnToReview`를 초안 cursor에 표시
- 수정 완료: 다음 섹션이 아니라 검토로 복귀
- 새로고침/직접 진입: URL cursor를 읽고, 범위를 벗어난 `index`나 질문은 현재 데이터에서 유효한 cursor로 `replace`
- `cloneFrom` 등 기존 query는 cursor를 바꿀 때 병합하여 보존
- 등록 성공: 기존처럼 생성된 plan detail로 `replace`, 초안 제거
- `TripRoomChildLayout`과 플랫폼 navigation adapter에는 새 back interception을 추가하지 않음

## 7. 테스트 단위 계획

### 7.1 순수 흐름 테스트

새 파일: `src/features/plan-editor/first-plan-wizard-flow.test.ts`

- 기본 정보의 다음/이전 순서
- 제안 이유 건너뛰기
- 도시 추가 시 index 증가, 마지막 도시에서 숙소로 전환
- 동일 도시 재방문 허용
- 일정 겹침 오류와 날짜 공백 허용
- `찾는 중`, 교통 `NOT_CHECKED` 조건부 질문 생략
- 숙소 수는 route 수, 교통 수는 route 수 + 1
- 잘못된 query question/index 정규화
- domain validation 오류를 최초 수정 cursor로 매핑

### 7.2 질문 UI 테스트

새 파일: `src/features/plan-editor/components/FirstPlanWizard.test.tsx`

- 한 화면에 활성 질문의 form control만 노출
- `Enter` 또는 CTA로 다음 이동, IME 조합 중 중복 submit 방지
- 필수 오류 시 이동하지 않고 focus 및 오류 연결
- 선택 질문 건너뛰기
- 저장 중/저장 실패 상태와 입력 보존
- 모바일 하단 action과 AIT inset 연결

### 7.3 기존 테스트 확장

| 테스트 파일 | 추가 검증 |
|---|---|
| `src/components/galanda/trip-creation-progress.test.tsx` | 4개 메인 단계, 서브 단계 문구, active/complete 접근성 |
| `src/features/trip-create/TripCreatePage.test.tsx` | 첫 단계 표시와 기존 생성·중복 submit 회귀 |
| `src/features/trip-setup/TripCompanionSetupPage.test.tsx` | 두 번째 단계, 공유/건너뛰기, 호스트 권한, AIT inset 회귀 |
| `src/features/plan-editor/hooks/usePlanEditorState.test.ts` | cursor 저장·복원, legacy 초안 파싱, 사용자 격리, discard 후 제거 |
| `src/features/plan-editor/PlanCreatePage.test.tsx` | 최초 여정 질문 렌더링, URL 정규화, 다음/이전, 검토 수정 복귀, 등록 payload, 실패 보존 |
| `src/features/plan-editor/PlanCreatePage.recommendation.test.tsx` | 추천 loading/error에도 CTA 유지, 다른 사용자가 먼저 등록한 뒤 FIRST_PLAN 추천 중단 |
| `src/features/plan-home/PlanHomePage.test.tsx` | 소유자 초안만 `이어서 작성하기`, 저장 cursor 진입, 다른 사용자 초안 무시 |
| `src/app/trip-creation-navigation.test.tsx` | 여행방 → 동행자 → 질문 흐름 → 검토 → plan detail, 시스템 Back의 Trip Room anchor |

### 7.4 회귀 및 수동 검증

- 기존 계획 추가·수정·복제는 여전히 섹션 편집 화면을 사용한다.
- confirmed room, 권한 없음, revision conflict, 오프라인/네트워크 실패 동작을 회귀 확인한다.
- Web/PWA 320, 360, 390, 430px에서 가로 스크롤, 키보드 가림, 하단 CTA, focus 이동을 확인한다.
- Apps-in-Toss build를 별도 확인한다. 브라우저 검증을 실제 AIT WebView 검증으로 간주하지 않는다.

## 8. 구현 순서

### Phase 1 — 흐름 기반과 진행 표시

- [ ] `first-plan-wizard-flow.ts`와 순수 테스트 추가
- [ ] `TripCreationProgress`를 4단계 + 서브 단계 형식으로 변경
- [ ] `StoredPlanEditorDraft`에 optional cursor 저장/복원 추가
- [ ] legacy draft와 기존 edit/clone 회귀 테스트 통과

완료 기준: 폼 데이터만 주면 현재/다음/이전 질문이 결정되고, 새로고침 후 같은 질문을 복원할 수 있다.

### Phase 2 — 기본 정보와 공통 질문 shell

- [ ] `FirstPlanWizard` 공통 shell 구현
- [ ] 제목, 제안 이유, 인원 질문 연결
- [ ] `PlanCreatePage` 최초 여정 분기와 query 정규화 연결
- [ ] 질문 focus, validation, 저장 상태, 하단 action 연결

완료 기준: 최초 여정만 기본 정보가 질문별로 보이고, 기존 여행안 추가·수정·복제 UI는 변하지 않는다.

### Phase 3 — 반복 경로·숙소·교통

- [ ] 경로 반복 질문과 도시 추가/종료 결정 구현
- [ ] 경로별 숙소 상태 및 조건부 숙소명 구현
- [ ] route 수 + 1 교통 구간과 조건부 endpoint 구현
- [ ] 확인 상태별 교통수단/소요시간 질문 구현
- [ ] route 변경 후 종속 값 보존 및 검토 필요 상태 연결

완료 기준: 최소 등록 데이터가 질문 순서대로 만들어지고, 반복 도시·날짜 공백·unknown 상태가 기존 도메인 계약과 일치한다.

### Phase 4 — 검토·재개·협업 경계

- [ ] 검토 수정 링크를 정확한 질문 cursor에 연결
- [ ] 수정 완료 후 검토 복귀
- [ ] Plan Home의 소유자 초안 재개 CTA 연결
- [ ] 다른 참여자의 선등록 시 대안 여행안 전환
- [ ] confirmed room 및 등록 실패 시 초안 보존

완료 기준: 검토에서 잘못된 항목을 바로 수정하고 돌아오며, 협업 중 상태 변경에도 입력을 잃지 않는다.

### Phase 5 — 회귀 검증과 문서 정합성

- [ ] 관련 focused test 실행
- [ ] Web/PWA 반응형·키보드·접근성 렌더 검증
- [ ] Apps-in-Toss build 및 가능한 경우 실제 WebView 검증
- [ ] `docs/acceptance/2026-08-18-mvp-acceptance-test-matrix.md`의 TR-02/PL-03 갱신
- [ ] `pnpm check`
- [ ] 최종 diff와 `git diff --check` 확인

## 9. 검증 명령

```bash
pnpm vitest run \
  src/features/plan-editor/first-plan-wizard-flow.test.ts \
  src/features/plan-editor/components/FirstPlanWizard.test.tsx \
  src/features/plan-editor/hooks/usePlanEditorState.test.ts

pnpm vitest run \
  src/components/galanda/trip-creation-progress.test.tsx \
  src/features/trip-create/TripCreatePage.test.tsx \
  src/features/trip-setup/TripCompanionSetupPage.test.tsx \
  src/features/plan-editor/PlanCreatePage.test.tsx \
  src/features/plan-editor/PlanCreatePage.recommendation.test.tsx \
  src/features/plan-home/PlanHomePage.test.tsx \
  src/app/trip-creation-navigation.test.tsx

pnpm check
git diff --check
```

## 10. 완료 조건

- [ ] 첫 여행안 생성에서 한 화면은 하나의 입력 또는 하나의 선택만 요구한다.
- [ ] 사용자는 허용된 선택 정보를 미정으로 두고 계속 진행할 수 있다.
- [ ] 진행 표시에서 메인 단계와 현재 서브 단계가 구분된다.
- [ ] 새로고침, 닫기 후 재진입, 네트워크 실패에도 소유자 초안과 질문 위치가 유지된다.
- [ ] 검토 화면은 기존 도메인 검증을 사용하고 정확한 수정 질문으로 이동한다.
- [ ] 동일 도시 재방문과 날짜 공백을 잘못 막지 않는다.
- [ ] 다른 참여자가 먼저 계획을 등록해도 현재 초안을 대안 계획으로 등록할 수 있다.
- [ ] 기존 계획 추가·수정·복제, 권한, confirmed room, optimistic concurrency 계약이 유지된다.
- [ ] Web/PWA와 Apps-in-Toss의 safe-area, focus, touch target, 키보드 사용성이 회귀하지 않는다.
- [ ] focused test와 `pnpm check`가 통과한다.

## 11. 범위 밖

- 서버 API, Effect use case, DB schema/migration 변경
- 질문별 top-level route
- 범용 wizard framework 또는 새 상태 관리 라이브러리
- 시스템 뒤로가기를 질문별 history로 바꾸는 플랫폼 작업
- 첫 생성에서 가격, 예약 URL, 환승 여부 등 모든 선택 필드 수집
- 기존 여행안 추가·수정·복제 화면의 질문형 전환

## 12. 참고한 현재 소스

- `src/features/trip-create/TripCreatePage.tsx`
- `src/features/trip-setup/TripCompanionSetupPage.tsx`
- `src/features/plan-editor/PlanCreatePage.tsx`
- `src/features/plan-editor/components/PlanEditorSections.tsx`
- `src/features/plan-editor/hooks/usePlanEditorState.ts`
- `src/features/plan-home/PlanHomePage.tsx`
- `src/components/galanda/trip-creation-progress.tsx`
- `src/app/app-router.tsx`
- `src/app/layouts/TripRoomChildLayout.tsx`
- `src/core/domain/room.ts`
- `src/core/usecases/trip-room/save-plan.ts`
- `docs/ui-foundation.md`

`docs/solutions/`에는 이 흐름에 재사용할 별도 해결 문서가 없어 현재 코드와 테스트를 기준으로 계획했다.
