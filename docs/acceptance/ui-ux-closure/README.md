# UI/UX Closure Review Pack

상위 [#125](https://github.com/dydfuf/galanda-ait/issues/125), 준비 작업 [#126](https://github.com/dydfuf/galanda-ait/issues/126).

## 환경과 실행

- 기준 코드: `4fa9331870f5f43a93274bfabba16c4f66efaffc` (PR #134).
- staging: `https://galanda-staging.88dydfuf.workers.dev`.
- 이번 작업에서 해당 코드로 배포한 Worker: `f3227555-5e25-4b8b-a028-4b29f0b7450b`, tag `4fa9331870`.
- 배포 전 `/api/auth/config` 404, 배포 후 `{"emailAndPassword":true}` 확인. 공유 HOST와 독립 MEMBER 모두 실제 브라우저 로그인 후 `/api/session`의 `isAuthenticated: true`, `accountType: REGISTERED` 확인.
- 관찰 환경: macOS 26.6.2, 설치된 Chrome 152.0.0.0(headless), ko-KR, Asia/Seoul, DPR 1. desktop browser viewport 확인이며 실기기나 설치형 PWA 검증이 아니다.
- Node 24.19.0, pnpm 9.15.1. `pnpm check` 기준선: 146개 파일 / 1,466개 테스트 및 DB drift, Web/AIT build 통과.
- DEV 카탈로그 변경은 이 브랜치의 로컬 코드다. `pnpm dev:vite --host 127.0.0.1` → `http://127.0.0.1:5173/dev`. 이 서버의 카탈로그 결과를 staging 저장 성공으로 해석하지 않는다.

## 검증 정책

2026-09-08 사용자 결정: **E2E는 테스트하지 않는다.** Playwright·자동 screenshot baseline·browser CI를 추가하거나 복원하지 않는다. 기존 Vitest·typecheck·`pnpm check`를 유지하고, 실제 화면은 브라우저 직접 조작 및 수동 QA 기록으로 확인한다.

증거 수준은 소스 / 컴포넌트(jsdom) / DEV fixture 실제 렌더 / staging 실제 HTTP·브라우저 / simulated inset / 실기기 / 사람 관찰로 구분한다. 자동화 runner의 부재는 blocker가 아니다. 실제 모바일 키보드·OS safe-area·설치형 PWA·보조기술·처음 온 참여자 관찰은 별도 증거가 필요하다.

## 자료와 소유권

| 자료 | 역할 |
| --- | --- |
| [inventory.md](inventory.md) | 실제 route, 대표 상태와 검증 책임 |
| [scenarios.md](scenarios.md) | 독립 actor, 재현 데이터, 시작·reset 절차, 시나리오 ID |
| [findings.md](findings.md) | UXF 단일 원본, 수정과 원래 여정 재검증 연결 |
| [evidence.md](evidence.md) | 캡처·실행 환경·검증 결과 |
| [기존 design-qa](../../../design-qa.md) | PR #133의 샘플 API 시각 자료. 실제 인증·저장 증거와 구분 |

#126 최소 준비: 배포 식별, 독립 로그인 두 세션, 태그가 있는 실제 여행방, 시나리오·reset·증거 형식이 준비됐다. #127~#130은 이 기준선으로 점검을 시작할 수 있다. 전체 시나리오를 통과한 것은 아니다.

| 작업 | 단계 | 구현·재검증 책임 |
| --- | --- | --- |
| #126 | 점검 중 | 현재 Codex 작업: Review Pack·DEV 경계·카탈로그 |
| #127 | 점검 중 | 현재 Codex 작업: 생성·재개, UXF-002 |
| #128 | 준비됨 | 현재 Codex 작업: 독립 두 세션·협업 |
| #129 | 준비됨 | 현재 Codex 작업: 전역 UI·저장/가져오기 |
| #130 | 점검 중 | 현재 Codex 작업: 공통 geometry·접근성·실패 상태 |
| #131 | 준비됨 | 실제 finding의 공통화 판단·회귀·#123 대응표 |

**2026-09-09 사용자 결정: 지금은 실기기 QA 보류.** 실제 키보드·OS safe-area·설치형 PWA는 미검증으로 유지한다. #130 보고서는 실제 확보한 환경만 통과로 기록하고 나머지 필수 항목의 해제 조건을 남긴다. P0/P1은 수정·재검증 전 종료하지 않는다.

## 2026-09-09 작업 중단 지점

사용자 요청에 따라 현재 진행 중인 키보드/하단 여백 수정까지만 마무리하고 추가 매트릭스 실행은 중단한다. 실기기 QA 보류 결정도 유지한다.

- #126: PR #135 머지. 최소 Review Pack 사용 가능. 아직 전체 준비 checklist 완료로 닫지 않음.
- #127: PR #136 머지·staging 재검증. 복수 도시/이어서 쓰기/검토 수정/local 저장 실패/offline/등록 실패·재시도 확인. IME·owner 전환 등 남은 항목은 [UX-02](reports/UX-02-creation.md).
- #128: PR #137 머지·staging 재검증. 열린 화면 갱신과 일정 입력 유실 수정, 두 탭 충돌·재조회 장애·확인 직전 추가 변경 복구 확인. [UX-03](reports/UX-03-collaboration.md).
- #129: 실제 탐색 저장/실패/새 여행·기존 여행 import/공개 해제 거부와 theme 확인. [UX-04](reports/UX-04-global.md).
- #130: simulated keyboard에서 발견된 공통 여백·ResizeObserver 수정 마무리. [UX-05](reports/UX-05-quality.md).
- #131: 발견된 원인별 책임 계층과 #123 대응표 정리. [UX-06](reports/UX-06-foundation.md).

최신 배포 완료: main `832cc8d574`(PR #137), staging `142a5975-228f-4834-bbd2-8cdc6beec5ef`. #130 여백 변경은 아직 별도 로컬 코드이므로 배포 확인을 분리한다. 전체 이슈 완료나 실기기/PWA 수용을 주장하지 않는다.
