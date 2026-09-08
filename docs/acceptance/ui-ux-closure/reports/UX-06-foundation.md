# UX-06 공통 계약 및 #123 대응표

2026-09-09 사용자 요청에 따른 현재 작업 보고. 전면 Presenter 이관이나 별도 UI framework는 추가하지 않았다.

| finding | 책임 계층/최소 변경 | 증거 |
| --- | --- | --- |
| UXF-001 | router의 DEV lazy import 자체를 gate | PR #135, Web/AIT production 제외 및 `/dev` 404 |
| UXF-002 | 순수 question-sequence의 초기 질문 계산 | PR #136, regression 및 실제 3/12 |
| UXF-003 | 기존 공통 HTTP client의 fetch 오류 경계 | PR #136, 취소/HTTP 분류 유지, staging 한국어 실패/복구 |
| UXF-004/005 | Query 읽기/편집 policy와 itinerary editor local state | PR #137, active 갱신·viewer key·재조회 장애/충돌 입력 보존 |
| UXF-006 | PageBody clearance / BottomAction observer | 기존 CSS 변수와 observer 재사용, 공통 사용처 17개 확인, fixture geometry 및 기존 contract 검사 |

| #123 잔여 조건 | 현재 대응 |
| --- | --- |
| runtime typed Presenter/View/event | 기존 PR #124 및 현재 gate 재사용; 전면 이관 추가 없음 |
| geometry/긴 accessory/footer cleanup | #126 fixture, page-chrome cleanup test, UX-05 전후 측정 |
| 대표 화면 전후 | 수동 캡처와 실제 HTTP/컴포넌트 구분. 자동 screenshot baseline 범위 제외 |
| 모바일 폭/desktop | 320/360/390/430/1280px 표본, 실제 기기 수용 아님 |
| simulated/실제 keyboard | UX-05의 CSS inset은 simulated. 실제 기기는 사용자 보류 |
| production fixture 제외 | PR #135 Web/AIT bundle 및 route 확인 |
| browser command/CI | 사용자 결정으로 E2E runner 제외. 기존 Vitest/typecheck/pnpm check/CI 유지 |
| 문서/API | ui-foundation의 footer/keyboard 계약 갱신, 현재 source 유지 |

#131은 전체 회귀/남은 수동 acceptance 종료를 뜻하지 않는다. #123의 CLOSED 상태는 유지하되 미검증 항목을 완료로 소급하지 않는다. 추가 매트릭스 실행은 사용자 요청으로 중단한다.
