# Evidence

환경은 [README](README.md). staging 캡처는 `4fa9331870` / version `f3227555-5e25-4b8b-a028-4b29f0b7450b`, DEV 캡처는 #126 작업 브랜치의 실제 View와 고정 fixture다. 아래는 자동 baseline이 아닌 수동 QA 증거다.

| 증거 | 수준·조건 | 관찰 |
| --- | --- | --- |
| [trips-empty-390](../../assets/ui-ux-closure/trips-empty-390.png) | staging HOST, 390×844, light | 실제 빈 계정·등록 세션, 새 여행 진입 |
| [companions-390](../../assets/ui-ux-closure/companions-390.png) | staging HOST, 390×844, light | 서버 여행방 생성 후 동행자/미정 이동 |
| [wizard-headcount-390](../../assets/ui-ux-closure/wizard-headcount-390.png) | staging HOST | UXF-002 `3/100` 실제 재현 |
| [creation-invalid-date-390](../../assets/ui-ux-closure/creation-invalid-date-390.png) | staging HOST | 도착 전 출발일 오류, 다음 disabled |
| [creation-review-390](../../assets/ui-ux-closure/creation-review-390.png) | staging HOST | 숙소/교통 미정으로 검토까지 진입 |
| [creation-publish-failure-390](../../assets/ui-ux-closure/creation-publish-failure-390.png) | staging 실제 UI + 특정 HTTP 요청 차단 | 입력 보존, 실패 안내. 통제된 네트워크 주입이며 실제 서버 5xx와 구분 |
| [plan-created-390](../../assets/ui-ux-closure/plan-created-390.png) | staging HOST, 390×844 | 차단 해제 후 재시도 성공, 상세 진입 및 실제 서버 후보 1개·revision 2 확인 |
| [creation-conflict-390](../../assets/ui-ux-closure/creation-conflict-390.png) | staging 실제 HOST/MEMBER | MEMBER 가입으로 revision 2→3, HOST 대안 등록 conflict. 입력 보존 후 재시도 성공: revision 4, 후보 2개·멤버 2명 |
| [invite-member-390](../../assets/ui-ux-closure/invite-member-390.png) | staging 독립 MEMBER | 안전하게 전달된 실제 초대, 닉네임 참여 후 첫 여행안 상세 이동 |
| [plans-two-candidates-390](../../assets/ui-ux-closure/plans-two-candidates-390.png) | staging HOST | 실제 두 후보, 비용 미정·예약 확인 전, 의견 0/2 표시 |
| [wizard-invalid-error-390](../../assets/ui-ux-closure/wizard-invalid-error-390.png) | DEV fixture, 390×844 light | 날짜 validation+저장 실패 독립 표현, active footer 1 |
| [wizard-long-320](../../assets/ui-ux-closure/wizard-long-320.png) | DEV fixture, 320×740 light | 긴 도시명/설명/3줄 CTA, 가로 overflow 없음 |
| [wizard-offline-saving-360](../../assets/ui-ux-closure/wizard-offline-saving-360.png) | DEV fixture, 360×800 light | offline 안내와 SAVING 독립 상태. 실제 localStorage/network 실행 아님 |
| [wizard-review-dark-430](../../assets/ui-ux-closure/wizard-review-dark-430.png) | DEV fixture, 430×932 dark | review-return cursor의 이전 행동, 날짜 input·SAVED |
| [wizard-choice-focus-desktop](../../assets/ui-ux-closure/wizard-choice-focus-desktop.png) | DEV fixture, 1280×900 dark | native radio focus·선택 카드, footer 1, 가로 overflow 없음 |
| [production-dev-404](../../assets/ui-ux-closure/production-dev-404.png) | 로컬 Web production preview `/dev` | 개발 route 접근 불가, 정상 복귀 버튼 |

## 실행 결과

- baseline `pnpm check`: 146개 파일 / 1,466개 테스트, exit 0.
- #126 focused `pnpm exec vitest run src/features/dev/DevDesignPage.test.tsx`: 5개 테스트 통과. footer 교체/cleanup과 날짜 오류·저장 실패·offline 축 확인.
- #126 `pnpm check`: 146개 파일 / 1,468개 테스트, exit 0. `build`/`build:ait` 내부 typecheck, DB drift, lint 포함. 기존 warning 유지.
- Web/AIT 산출물에서 DEV 청크/fixture 문자열이 제외됨을 확인. Web production preview `/dev`는 404 UI.
- 독립 HOST/MEMBER의 실제 로그인 및 `/api/session` REGISTERED 확인.
- WIZ-01 및 WIZ-08 일부: 생성 → 숙소/교통 미정 → 검토 → 네트워크 등록 실패 → 원인 해제 → 재시도 → 실제 plan detail. 서버 planCount 1, VOTING, revision 2. 409/중복 click/다른 실패 종류는 이 결과와 별도다.
- PACK-01 재실행: `/dev?preview=wizard&scenario=invalid-date&draft=ERROR`를 재진입해 날짜 오류와 저장 실패, 단일 footer를 확인. URL 선택 상태를 컴포넌트 테스트도 보호한다.

## 아직 완료 증거가 없는 항목

실기기 키보드·OS date picker·safe-area, 설치형 PWA, screen reader, 사람 참여 관찰, WIZ/COL/NAV 전체 매트릭스는 후속 보고서에서 각각 판정한다. 이 파일의 fixture 캡처나 전체 gate를 해당 항목의 통과로 사용하지 않는다.

## 2026-09-09 추가 증거와 현재 판정

- [UX-02 생성](reports/UX-02-creation.md): 3/12, 복수 도시·재개·검토 수정·저장 실패·offline·이중 등록 방지·한국어 오류 후 복구.
- [UX-03 협업](reports/UX-03-collaboration.md): 실제 403/404/401 경계, active polling, 입력 유실 수정, 재조회 장애/충돌 및 acknowledgement race 복구.
- [UX-04 전역](reports/UX-04-global.md): dark theme, save/import, 공개 중단 410, 초기 조회 실패/재시도.
- [UX-05 품질](reports/UX-05-quality.md): simulated keyboard의 입력/CTA 전후 측정, 현재 공통 여백 수정·검사.
- [UX-06 Foundation](reports/UX-06-foundation.md): 책임 계층·기존 계약·#123 충족/미검증/범위 제외 대응표.

실기기 QA와 나머지 매트릭스는 사용자 결정으로 각각 보류/중단이다. 이 기록을 전체 이슈 완료로 해석하지 않는다.
