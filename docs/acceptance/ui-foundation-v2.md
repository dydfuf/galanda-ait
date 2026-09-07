# UI Foundation v2: FirstPlanWizard 검증 기록

## 범위

- `WizardStepPage`가 단일 질문 화면의 본문 여백, progress, draft 상태, footer
  action을 소유한다.
- FirstPlanWizard는 typed event와 질문별 ViewModel을 사용하고, presenter는
  React/DOM/I/O 없이 순수하게 동작한다.
- 기존 draft, cursor, offline, publish/conflict, AI 준비 흐름과 Web/PWA 화면
  계약은 유지한다.
- UI foundation guard는 지정된 source scope에서 raw color, footer 우회,
  View의 runtime editor/query/storage import를 검출한다.

## 검증 명령

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:ui
pnpm check
```

현재 결과: `pnpm test` 146개 파일/1440개 테스트 통과, `pnpm test:ui` 8개
테스트 통과, `pnpm check` 통과(Drizzle drift, Web build, AIT build 포함).
lint에는 기존 warning만 남아 있다.

## 브라우저 증거

Playwright fixture로 320/360/390/430px 및 대표 desktop 1280px 폭에서 horizontal
overflow와 footer geometry를 확인하고, 390px long-question 화면을 snapshot으로
고정했다. 정상/invalid-date/저장 중/저장 실패/offline/review-return 상태 fixture도
제공한다.
offline accessory 높이는 DOM 측정값을 CSS 변수에 반영해 검증했다. safe-area와
keyboard inset은 Playwright에서 CSS 변수로 시뮬레이션했다.

실제 Apps-in-Toss WebView와 실제 키보드/기기 safe-area 검증은 이 이슈 범위가
아니며, native device evidence가 필요할 때 별도로 수행한다.
