# UX-02 생성 점검 — 진행 중

기준 환경·actor·데이터는 [Review Pack](../README.md), 재현 절차는 [scenarios](../scenarios.md). staging baseline `4fa9331870` / `f3227555-5e25-4b8b-a028-4b29f0b7450b`, Chrome desktop 390×844. 2026-09-08~09 KST.

| 시나리오 | 현재 결과 |
| --- | --- |
| WIZ-01 | 실제 새 방 → 미정 숙소/교통 → 검토 → 등록 → 상세. 서버 후보 1개/revision 2 확인 |
| WIZ-02 | 복수 도시 실제 실행 대기. 기존 sequence/index 컴포넌트·회귀 테스트 통과 |
| WIZ-03 | 출발일≤도착일 오류·다음 disabled 실제 확인. 나머지 입력 경계는 기존 focused 테스트 통과, 직접 조작 확대 예정 |
| WIZ-04~07 | 중단·복귀·새로고침·검토 수정·local 저장 실패의 실제 브라우저 점검 계속 |
| WIZ-08 | 등록 HTTP 요청 차단 → 실패 alert/입력 보존 → 차단 해제/재시도 성공. MEMBER 참여와 대안 등록의 실제 v2→v3 충돌 → 입력 보존 → 재시도, 후보 2개/revision 4 확인 |
| WIZ-09~11 | 실제 중복/IME/offline/owner 점검 대기. 기존 single-flight·owner·cursor 회귀 테스트 통과를 실제 화면 판정과 구분 |
| WIZ-12 | 320~430px viewport 증거는 [evidence](../evidence.md). 실기기 QA는 2026-09-09 사용자 결정으로 보류 |

## 수정과 검사

- UXF-002: 빈 routes로 진행률 순회가 100회에 도달함. 질문 수 계산에서만 최소 첫 도시 질문을 계산한다. actual draft나 navigation guard를 변경하지 않는다.
- UXF-003: `requestJson`에서 공통 fetch 실패를 한국어 `NETWORK_ERROR`로 전달한다. 성공 여부를 단정하지 않고 연결/처리 결과 확인을 요청한다. 취소·HTTP 권한/충돌·응답 decode 계약은 유지한다.
- 수정 전 새 regression 2개 실패(100개 질문, raw TypeError), 수정 후 `pnpm exec vitest run src/features/trip-create src/features/trip-setup src/features/plan-editor src/app/api-client.test.ts`: 22개 파일/331개 테스트 통과.
- `pnpm check`: 146개 파일/1,471개 테스트, lint/DB drift/typecheck/Web/AIT build 모두 exit 0. E2E runner 변경 없음.
- 수정된 배포의 WIZ-01/WIZ-08 재실행 전이며 #127을 완료로 처리하지 않는다.

## 처음 온 사용자 관찰 인계

과제: 숙소를 정하지 않은 여행을 만들고, 한 번 나갔다 돌아와서 검토의 날짜를 수정한 뒤 등록한다. 관찰자는 버튼 위치를 알려주지 않고 멈춤/오해한 저장 상태/반복 validation/도움 요청/개입 시점을 기록한다. 실제 참여자는 아직 확보하지 않았으며 현재 Codex 개발자 walkthrough를 사용자 연구로 해석하지 않는다. #127에서 제품 담당자가 참여자를 확보할 때 이 protocol로 재개한다.
