ADR: Canonical Trip Creation Wizard Product Contract

Date: 2026-09-04
Status: Accepted
Scope: Galanda Web/PWA 및 Apps in Toss의 신규 여행 생성과 첫 여행안 작성 UX
Supersedes: RAON-285와 PR #90에 기록된 7단계 section-based first-trip Wizard 기준선

1. Context

Galanda는 PR #90에서 다음 7단계 continuous Wizard를 도입했다.

여행 정보
→ 동행자
→ 기본 정보
→ 여행 경로
→ 숙소
→ 교통
→ 검토·등록

RAON-285는 이 구조를 당시 제품 기준선으로 존중하고, 화면 수만을 이유로 broad redesign을 하지 않는다는 검증 원칙을 기록했다.

이후 PR #106에서 실제 신규 여행 생성 UX가 다음 구조로 변경되었다.

1. 여행방
2. 동행자
3. 첫 여행안
4. 검토

이 중 `첫 여행안`은 section 하나를 한 화면에 표시하는 방식이 아니라, 사용자가 한 번에 하나의 primary decision에 집중하도록 single-question sub-wizard로 구성된다.

PR #113에서는 실제 question sequence가 여행 데이터에 따라 약 13~17개 화면이 될 수 있음을 전제로 `3/4 · 5/13` 형태의 sub-step progress, draft resume discoverability, validation feedback, deterministic publish CTA를 보강했다. 같은 PR의 repository quality gate는 140 test files / 1,369 tests와 `pnpm check`를 통과했다.

따라서 현재 구현과 과거의 7단계 제품 기준선이 서로 다른 source of truth를 가리키고 있다. 이 ADR은 현재 shipped UX를 공식 기준선으로 고정하고, 이후 단순화 여부를 판단할 검증 기준을 정의한다.

2. Decision

Galanda의 신규 여행 생성 UX는 다음 구조를 canonical product contract로 채택한다.

```text
[1. 여행방]
    ↓
[2. 동행자]
    ↓
[3. 첫 여행안]
    ├─ 한 화면 = 하나의 primary decision
    ├─ dynamic question sequence
    ├─ cursor 기반 draft save / resume
    └─ main progress + sub-step progress
    ↓
[4. 검토]
    ├─ 입력 요약
    ├─ 특정 question으로 수정 jump
    └─ deterministic publish
```

PR #90의 7단계 section-based Wizard는 구현 이력으로 남기되 더 이상 현재 first-trip UX의 제품 기준선으로 사용하지 않는다.

추가 여행안, 복제, 수정의 section-based editor는 이 ADR의 변경 대상이 아니다.

3. Single-question Flow Invariant

첫 여행안에서는 가능한 한 한 화면에 하나의 primary decision을 둔다.

이 원칙은 `화면 수를 최대한 적게 만든다`는 의미가 아니다.

예를 들어 다음 항목은 각각 독립적인 사용자의 판단이 필요할 수 있다.

- 여행안 제목
- 제안 이유
- 기준 인원
- 도시
- 도착일
- 출발일
- 도시 추가 여부
- 숙소 결정 상태
- 숙소명
- 교통 결정 상태
- 교통수단
- 이동시간

여행 도시 수와 선택한 상태에 따라 전체 sub-step 수는 동적으로 달라질 수 있다.

13~17개의 화면 전환이 발생한다는 사실만으로 section-based multi-field 화면으로 되돌리지 않는다. 반대로 실제 사용성 데이터에서 불필요한 반복, 높은 이탈, 과도한 backtracking이 확인되면 질문 통합 또는 progressive disclosure를 검토한다.

4. Progress Contract

상위 progress는 다음 4단계를 표현한다.

```text
여행방 / 동행자 / 첫 여행안 / 검토
```

`첫 여행안` 내부에서는 현재 question 위치를 함께 표시할 수 있다.

예:

```text
3/4 · 5/13
첫 여행안 · 여행 경로
```

상위 4단계는 사용자가 journey의 큰 위치를 이해하기 위한 정보다.

sub-step count는 방향 감각을 돕는 보조 정보이며 제품 KPI가 아니다. 화면 수를 줄여 counter 숫자를 낮추는 것 자체를 성공으로 보지 않는다.

5. Draft and Resume Contract

첫 여행안의 question position은 draft와 함께 복구 가능해야 한다.

현재 `FirstPlanWizardCursor`와 `wizardCursor` persistence를 이 목적의 canonical mechanism으로 사용한다.

다음 invariant를 유지한다.

- 새로고침 또는 이탈 후 owner draft를 이어서 작성할 수 있다.
- invalid/stale cursor는 현재 form data에 맞는 유효한 question으로 normalize한다.
- review에서 `수정`으로 진입한 경우 해당 question을 완료한 뒤 review로 복귀할 수 있다.
- legacy draft를 읽을 수 있는 backward compatibility를 유지한다.

6. Completion and AI Boundary

AI next-best-action recommendation은 creation completion을 보조할 수 있지만 핵심 completion path를 소유하지 않는다.

다음 invariant는 RAON-241과 PR #94에서 이어받아 유지한다.

```text
recommendation loading/failure가 editor, back, review, publish action을 block하지 않는다.
```

따라서 검토 화면의 `여행안 제안 등록`은 recommendation latency나 failure와 독립적인 deterministic action이어야 한다.

AI가 추천하는 action은 현재 deterministic domain eligibility와 publish validation을 완화하지 않는다.

7. Validation Criteria

이 UX의 이후 개선은 raw screen count가 아니라 사용자 effort와 completion quality를 기준으로 판단한다.

우선 검증할 신호는 다음과 같다.

1. **Creation completion**
   - creation start → review → publish까지 완료되는가?

2. **Resume quality**
   - 중단 후 `이어서 작성하기`로 올바른 question에서 복구되는가?
   - resume 후 publish까지 완료되는가?

3. **Validation friction**
   - 같은 validation error가 반복되는가?
   - final review에서 예상하지 못한 required correction이 집중되는가?

4. **Backtracking**
   - 특정 question 사이의 반복적인 이전/다음 이동이 발생하는가?
   - review → edit → review 왕복이 특정 필드에 과도하게 집중되는가?

5. **Abandonment**
   - 특정 question 또는 section에서 creation 이탈이 집중되는가?

6. **Qualitative mobile usability**
   - 사용자가 현재 결정해야 하는 한 가지와 나중에 정할 수 있는 정보를 구분할 수 있는가?
   - main progress와 sub-step progress를 혼동하지 않는가?

제품 telemetry가 필요하면 별도의 analytics stack을 만들지 않고 RAON-222의 product-event infrastructure 위에서 최소 이벤트를 확장한다.

8. Change Policy

첫 여행안 UX를 변경할 때 다음 원칙을 따른다.

허용:

- 실제 usability evidence에 따른 question 통합/분리
- 반복 입력 제거와 safe prefill
- optional question의 skip/progressive disclosure 개선
- validation timing과 copy 개선
- resume/backtracking friction 개선

근거 없이 하지 않는 것:

- `13~17 screens가 많아 보인다`는 이유만으로 section-based form으로 회귀
- counter 숫자를 줄이는 것을 목표로 한 질문 병합
- AI recommendation을 mandatory gate로 승격
- publish domain invariant 완화

변경이 이 계약의 핵심 원칙을 바꾸는 경우 새 ADR 또는 이 ADR을 supersede하는 decision record를 작성한다.

9. Consequences

장점:

- 모바일에서 한 번에 처리해야 하는 cognitive scope가 명확해진다.
- progress와 resume가 question 단위로 정확해진다.
- validation을 필요한 decision 가까이에서 제공할 수 있다.
- current runtime과 제품 문서의 source of truth가 일치한다.

Trade-off:

- 첫 여행안 작성에는 section-based form보다 많은 화면 전환이 발생할 수 있다.
- dynamic sequence 때문에 총 sub-step 수가 여행 데이터에 따라 달라진다.
- 장기적으로는 product telemetry와 qualitative testing을 통해 질문 granularity를 계속 검증해야 한다.

이 trade-off를 현재 MVP/mobile UX에 대해 수용한다.

10. References

- GitHub PR #90 — continuous trip creation wizard
- GitHub PR #94 — keep publish CTA available while AI recommendation loads
- GitHub PR #106 — granular first-plan single-question wizard
- GitHub PR #113 — sub-step progress, validation, resume and CTA stabilization
- Linear RAON-222 — beta product event taxonomy / observability
- Linear RAON-241 — adaptive first-plan journey and non-blocking NBA contract
- Linear RAON-285 — Wizard cognitive-load validation record based on the former 7-step baseline
- `PROJECT.md` — implementation inventory and current delivery state
