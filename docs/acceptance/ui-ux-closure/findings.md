# Findings — 단일 원본

같은 원인에는 한 UXF만 사용한다. 분류는 재현된 결함 / 사용성 가설 / 시각 개선 / 미검증 위험이다. P0/P1은 해결·재검증 전 종료하지 않는다. P2/P3 유예는 후속 issue·책임·사용자의 명시적 결정이 필요하다.

## UXF-001 — 개발 카탈로그가 production chunk에 포함됨

- 분류: 재현된 결함, P2 (개발 전용 산출물 제외 계약 위반. 인증 우회·실제 secret 노출 증거 없음).
- scenario: PACK-01, production build, actor 없음.
- 기준: `4fa9331870`; 2026-09-08 macOS/Node24. 실제 staging 배포 출력에도 `DevDesignPage-*.js` 포함.
- 재현: `pnpm build:web` 후 `dist/assets/DevDesignPage-*.js` 확인. route는 숨겨지지만 최상위 `lazy(import(...))`가 청크를 보존한다.
- 기대: DEV route와 카탈로그·synthetic data가 Web/AIT production 산출물에서 제외됨.
- 조치: #126, `src/app/router.tsx`에서 lazy 선언 자체를 `import.meta.env.DEV`로 제한. 모든 DevDesignPage 사용처 확인.
- 재검증: 브랜치 `pnpm check` 146개 파일/1,468개 테스트 및 Web/AIT 빌드 통과. 두 빌드에서 DevDesignPage/DevWizardPreview 청크·고정 예시 문자열 없음. Web production preview `/dev`는 404 UI.
- fix PR: [PR #135](https://github.com/dydfuf/galanda-ait/pull/135) 머지 (`9310c9111c`), CI verify 통과. staging 재배포 전.

## UXF-002 — 도시 입력 전 진행률이 100개 질문으로 표시됨

- 분류: 재현된 결함, P2 (질문 수 안내 오류, 생성 진행 가능).
- scenario: WIZ-01, HOST 신규 여행안의 기본 정보/인원 질문.
- 기준: staging `f3227555-5e25-4b8b-a028-4b29f0b7450b`, 코드 `4fa9331870`, 2026-09-08 390×844.
- 재현: 빈 여행방 → 첫 여행안 제목 → 제안 이유 건너뛰기 → 인원. `3/100` 표시.
- 기대: 존재하는 질문 순서의 정확한 진행 정보. 순회 보호 한도를 질문 개수로 표시하지 않음.
- 근거: [headcount 캡처](../../assets/ui-ux-closure/wizard-headcount-390.png). 빈 routes에서 next/normalize가 도시 질문으로 되돌아가 100회 순회했다.
- 구현 owner: #127, 현재 Codex 작업. `first-plan-wizard-flow.ts`의 모든 sequence/progress 호출자와 회귀 테스트 확인 후 최소 수정.
- 수정: 질문 수 계산에서만 최소 첫 도시의 질문을 포함한다. 실제 draft와 navigation normalize는 변경하지 않는다. 신규 regression은 수정 전 3/100으로 실패, 수정 후 3/12 및 입력 불변성을 확인했다. 관련 331개 테스트, 전체 146개 파일/1,471개 테스트와 `pnpm check` 통과. 실제 브라우저 재검증은 수정 배포 후 진행한다.

## UXF-003 — 등록 네트워크 실패에 내부 영문 오류를 그대로 표시

- 분류: 재현된 결함, P2 (복구 행동은 유지되나 사용자 안내 불충분).
- scenario: WIZ-08 / RES-01, HOST 검토 화면에서 등록 요청만 abort.
- 기준: UXF-002와 같은 staging. `role=alert`에 `Failed to fetch` 표시.
- 기대: 등록이 확인되지 않았음을 한국어로 알리고 입력 보존·재시도 경로 안내.
- 실제: 입력과 등록 버튼은 유지됨. 성공 상태로 전환하거나 초안을 삭제하지 않음.
- owner: #127. 모든 읽기/변경이 거치는 기존 `requestJson`에서 fetch 실패만 `ApiClientError`의 NETWORK_ERROR로 전달한다. HTTP 응답·409·Schema 검증은 기존 경계 유지, AbortError와 signal 취소 사유도 보존한다.
- 수정: 연결과 처리 결과를 확인한 뒤 재시도하도록 한국어로 안내한다. 실패한 회귀 테스트 재현 후 수정했으며 읽기/변경 및 요청 취소 검증, 관련 331개 테스트와 전체 `pnpm check` 통과. 실제 브라우저 재검증은 수정 배포 후 진행한다.

## 새 finding 기록 필드

`UXF ID / 분류 / 심각도·이유 / scenario·route·state·actor / 환경·SHA·배포·시각 / 재현 / 실제·기대·영향 / evidence 수준 / 구현 owner·issue / fix PR·SHA / 동일 조건 재검증 / 잔여 위험`.
