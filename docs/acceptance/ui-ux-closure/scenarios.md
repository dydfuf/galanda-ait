# 재현 데이터와 시나리오

## Actor

- HOST: 기존 `agent-ui@staging.galanda.invalid`. 자격 증명 위치·로그인은 [runbook](../../staging-operations-runbook.md#staging-이메일-테스트-계정)을 따른다.
- MEMBER: 이번 작업에서 staging 가입 UI로 만든 `agent-ux125-member@staging.galanda.invalid`, 표시 이름 `UX125 동행자`. 해당 실행 호스트의 `~/.config/galanda/ux125-member.json`에 credential을 `0600`으로 보관했다.
- C: 별도 비로그인 브라우저 세션. private 접근·guest 흐름은 HOST/MEMBER와 별개로 수행한다.
- 직접 조작 도구의 세션명: `ux125-host`, `ux125-member`, `ux125-dev`. 서로 다른 cookie/localStorage를 사용한다. 일반 브라우저에서는 독립 프로필을 사용한다.
- 로그인 폼을 채운 상태에서 password 값을 포함하는 접근성 snapshot을 저장하지 않는다. 캡처·로그·네트워크 출력에서 password/cookie/invite capability를 제거한다. credential은 프로세스 안에서 읽어 폼에 전달하며 명령 인자로 넣지 않는다.

## 실제 데이터 생성과 reset

reference date는 2026-09-08 KST, 일정 예시는 2026-10-10~13이다. 이후 재사용 시 미래 날짜를 선택하고 기준일을 함께 기록한다.

1. HOST의 내 여행에서 `새 여행 만들기` → `UX-125 제주 가을 여행` → `여행 만들고 계속`.
2. 동행자 단계에서 `미정으로 두고 다음`. 여행방은 이미 서버에 저장됐고 첫 여행안은 아직 등록 전이다.
3. 첫 여행안 제목 `UX125 제주 3박`, 제안 이유 건너뛰기, 비용 인원 2명, 제주, 도착 2026-10-10, 출발 2026-10-13.
4. 추가 도시 없음 → 숙소 알아보는 중 → 김포→제주 및 제주→김포, 두 교통편 모두 아직 안 정함 → 검토.
5. 중단/재개는 등록 전 내 여행으로 이동했다 돌아오고, 검토 수정은 해당 항목 버튼으로 진입한다. local draft는 같은 프로필·같은 owner 범위다.
6. 등록은 실제 성공 후 plan detail에서 확인한다. 실패 주입 상태를 해제한 뒤에만 재시도하며 생성 건수를 서버 데이터로 확인한다.
7. 두 후보/복수 도시는 다른 제목(`UX125 부산 경유`)의 추가 여행안으로 준비한다. 공개·저장·가져오기·확정·일정 변경은 해당 시나리오에서 자기 QA 데이터만 사용한다.
8. HOST가 발급한 초대는 출력하지 않고 MEMBER의 독립 프로필로 안전하게 전달한다. 닉네임 참여 후 실제 membership과 첫 의견 경로를 확인한다.

이번 실행은 최초 후보의 `다른 구성으로 제안하기`로 두 번째 후보 `UX125 제주 3박 대안`을 등록했다. MEMBER 참여와 등록의 실제 revision 충돌 후 입력 보존·재시도를 확인했고, 서버 revision 4에서 후보 2개/멤버 2명이다. 복수 도시·공개 listing·확정 이후 상태는 다음 여정에서 구성한다.

reset: 반복 실행은 `UX-125 <여정> <실행번호>` 이름의 새 방으로 구분한다. 카탈로그는 동일 URL 새로고침으로 reset한다. draft는 해당 QA 방의 `작성 초기화`만 사용한다. 기존 shared 계정의 전체 storage/cache 또는 다른 여행 데이터를 삭제하지 않는다. 공개 listing은 자기 QA listing만 공개 해제하고, 저장/후보는 해당 UI가 허용하는 자기 record만 정리한다. 현재 Trip 삭제 API가 없으므로 ad-hoc DB 삭제를 도입하지 않고 태그가 있는 방을 재현용으로 유지한다.

## DEV fixture

`pnpm dev:vite --host 127.0.0.1` 후 `/dev?preview=wizard&scenario=<상태>&draft=<상태>`로 진입한다.

- scenario: `normal`, `invalid-date`, `long-copy`, `offline`, `review-return`, `choice`.
- draft: `IDLE`, `SAVING`, `SAVED`, `ERROR` (독립 선택).
- 실제 Presenter와 View를 렌더한다. 입력·이전·다음은 이벤트 종류만 보여주고 값 저장/등록/AI를 실행하지 않는다. `SAVED`도 고정된 예시 표시다.
- 카탈로그 하단 CTA를 켠 상태에서 위자드로 이동해도 catalog footer가 unmount된다. 문서당 active page footer는 하나다.
- 실제 review→수정→review 이동은 #127에서 확인한다. `review-return` fixture 자체는 해당 cursor의 화면만 보여준다.

## 시나리오 ID

실행 절차·기대 동작의 원본은 각 최신 GitHub 이슈다. 결과가 없는 ID는 미검증이며 fixture 결과로 대체하지 않는다.

| ID | 대상 | 실행 원본 |
| --- | --- | --- |
| PACK-01 | 동일 URL로 위자드 날짜 오류+저장 실패를 다시 열고 footer/오류 확인 | #126, 위 DEV 절차 |
| WIZ-01~12 | 정상/복수 도시/validation/이탈/refresh/검토 수정/local 저장 실패/등록 실패·409/중복·IME/offline·AI/owner/모바일 | [#127](https://github.com/dydfuf/galanda-ait/issues/127) |
| COL-01~05 | 초대/비교·확정/변경 확인/freshness/경계·복귀 | [#128](https://github.com/dydfuf/galanda-ait/issues/128) |
| NAV-01~10 | 홈/여행/전역 왕복/탐색/저장/가져오기/원본 변경/마이/실패/시각 | [#129](https://github.com/dydfuf/galanda-ait/issues/129) |
| MOB-01~02, A11Y-01~02, RES-01, PWA-01 | 키보드·날짜/footer/focus/의미/복구/설치형 실행 | [#130](https://github.com/dydfuf/galanda-ait/issues/130) |

오류 주입: DEV 고정 상태와 실제 HTTP 브라우저의 요청 차단을 구분한다. 특정 QA mutation URL만 차단하고 관찰 후 해제한다. 권한/409는 실제 actor/revision 및 해당 서버 계층 테스트로 확인한다. 생산 인증 우회나 fake 성공 응답을 추가하지 않는다.

## 실제 생성한 추가 데이터와 재현 경계 (2026-09-09)

- HOST `UX-125 생성 복구 재검증`: 방 `75c93c89-06bf-4dbe-b96f-1d8f2227f0e2`, 부산(10/09~11)→제주(10/11~13), 첫 숙소 결정/둘째 미정, 교통 3구간 미정. 첫 여행안 제목 `UX125 부산 제주 복구 오프라인`, 이중 click 후 서버 후보 1개/revision 2.
- 기존 협업 방 `ecff0d8a-0570-4eee-929f-18a1d8510627`: 확정 일정 v5, MEMBER 확인 v5. 두 HOST 탭은 같은 계정/서로 다른 QueryClient이며 MEMBER는 독립 프로필이다.
- 공개 listing `f2e0b6aa-148c-403f-ba1d-7a0a66d9e0a6`: 기존 HOST 첫 후보를 기존 `POST /api/trips/:tripId/plans/:planId/explore-listing` + `{}`로 seed. 현재 게시 UI가 없어 API로 준비한 데이터이며 UI 게시 성공으로 주장하지 않는다. MEMBER 저장→새 여행 import→기존 여행 import를 실제 UI로 수행했다.
- import 대상 MEMBER 방 `be9eed8d-12f5-40f9-bf60-13a23870e753`, 후보 `d95a5570-f747-4fb5-917e-742a77eb2df6`, `42524248-cead-46a9-8f98-b2d6450432e5`.
- 공개 해제는 자기 listing만 기존 DELETE와 expectedRevision 1로 수행했다. unavailable UI와 실제 import 410 확인 후 기존 relist API와 expectedRevision 2로 복구, 현재 LISTED revision 3.
- 비로그인 `ux125-c`: private GET 401, login return 경로, 무효 초대와 404 확인. HOST가 MEMBER의 private 방을 GET하면 정보 없이 404. MEMBER가 HOST 확정 일정에 유효한 수정 payload를 보내면 403.
- actor credential, 원래 초대 capability는 기존 호스트 외부 파일만 사용한다. 본문에 넣지 않는다. 새로 재현할 때 공유 계정의 다른 데이터나 전체 storage를 지우지 않는다.
