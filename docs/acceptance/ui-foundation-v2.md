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
pnpm check
```

현재 결과: `pnpm test` 146개 파일/1440개 테스트 통과, `pnpm check` 통과
(Drizzle drift, Web build, AIT build 포함).
lint에는 기존 warning만 남아 있다.

## 검증 범위

이번 PR은 브라우저/E2E runner를 사용하지 않는다. Presenter, component,
typecheck, static contract guard와 canonical `pnpm check`로 검증한다.
실제 Web/PWA/AIT 런타임 및 기기 키보드는 이 기록에서 검증하지 않았다.
