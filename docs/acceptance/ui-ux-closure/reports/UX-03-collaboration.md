# UX-03 협업 점검 — 진행 중

환경/actor/seed는 [Review Pack](../README.md). 기준 staging `4fa9331870` / `f3227555-5e25-4b8b-a028-4b29f0b7450b`, 2026-09-08~09 KST. 독립 Chrome 프로필 HOST/MEMBER, HOST 320px / MEMBER 390px.

| 순서 | 실제 결과 |
| --- | --- |
| 초대/참여 | HOST 초대를 MEMBER에 안전하게 전달, 닉네임 참여 후 첫 후보 상세 |
| 의견 | MEMBER 좋아요 선택 → HOST의 대안 생성과 실제 v3→v4 충돌 → 선택 보존 후 재시도, 내 의견 수정하기 표시 |
| 비교 | 두 후보, 가격 미정과 좋아요 1/전체 참여 인원 2 표시. 라디오 선택 후 확인 dialog |
| 확정 | 최신 MEMBER 의견으로 HOST v4→v5 충돌. 최신 근거를 표시한 뒤 재시도 → 확정 일정 진입. MEMBER 새로고침 후 확정 일정 보기 |
| 변경/확인 | HOST 첫 교통 메모 수정 → MEMBER 변경 내용 확인 drawer에 수정 전/후 및 v2 → 확인했어요 → 안내 해제 |
| 계속 열린 화면 | 다음 HOST 숙소 메모 수정 이후 MEMBER 70초 동안 변경 안내 없음 → 새로고침 후 v3 변경 확인. UXF-004 |
| 편집/장애 | HOST 저장 전 메모 + 해당 fetch 실패/visibility 복귀 주입 → error fallback → 복구 때 기존 서버 값으로 초기화. UXF-005 |

[확정 일정](../../../assets/ui-ux-closure/itinerary-confirmed-320.png), [변경 확인](../../../assets/ui-ux-closure/itinerary-change-review-390.png). HTTP 검증으로 전체 권한/CAS를 대체하지 않는다.

## Freshness 정책

| 화면/데이터 | 기존 → 수정 | 실패/입력 및 무효화 |
| --- | --- | --- |
| Plan Home/Detail/Compare, trip detail(viewer key) | stale10s/focus/reconnect → stale0/mount/focus/reconnect + active30s | 기존 mutation의 trip family invalidation 유지. 조회 실패는 성공으로 표시하지 않음 |
| Itinerary read | 위와 같음. key에 viewer 추가 | revise/ack의 itinerary family invalidation 유지, 변경 확인과 권한을 viewer별 격리 |
| Plan create/edit, Itinerary edit | 공통 read 설정 → 진입 조회, polling/focus/reconnect 없음 | expectedRevision + explicit refetch/rebase 유지. 일정 편집 transient 재조회 실패에도 local patches 보존 |
| Home/내 여행 overview | 기존 stale30s/focus/reconnect, polling 없음 | local mutation의 overview invalidation |
| Activity drawer | 기존 stale0/focus/reconnect, 열 때 조회 | last-seen mutation의 overview/activity invalidation. 새로운 unread state나 polling은 만들지 않음 |
| Explore/session/AI | 기존 정책 유지, 협업 polling을 상속하지 않음 | RAON-279의 전체 비협업 정책·mutation 범위 정밀화 완료를 주장하지 않음 |

30초는 RAON-279의 기존 REST 기술 budget이다. background/offline에서는 요청하지 않으며 실시간 SLA가 아니다. 신규 fake-timer hook 검증은 active/background/focus/reconnect 및 editor explicit refetch, viewer 전환을 확인한다. 실제 수정 배포의 두 세션 재검증은 대기 중이다.

## 남은 실행

무효/이미 참여 초대, 비참여/만료 세션의 실제 서버 거부, 변경 확인 직전 추가 변경, 두 편집 session 충돌, 의견/확정/확인의 추가 실패 종류, deep-link/back/keyboard coverage는 계속 진행한다. #128을 완료로 처리하지 않는다. 실제 기기 QA는 사용자 결정으로 보류한다.

## 코드 검증

- 수정 전 입력 유실 regression 실패, 수정 후 권한 실패 차단과 입력 보존 통과.
- freshness hook과 itinerary focused 검사: 6개 파일/26개 테스트 통과. 기존 상수 모양 검사 1개를 실제 timer/focus/reconnect 동작 검사로 대체했다.
- 첫 `pnpm check`는 동시 실행 중 카탈로그 1개 테스트가 5초 timeout(나머지 1,476개 통과). 제한 시간·테스트·CI를 바꾸지 않고 `VITEST_MAX_WORKERS=2 pnpm check` 재실행: **147개 파일/1,477개 테스트**, lint/DB drift/typecheck/Web/AIT build exit 0.

## PR #137 배포 후 재검증

main `832cc8d574`, staging `142a5975-228f-4834-bbd2-8cdc6beec5ef`. 두 프로필에서 PWA 업데이트 버튼으로 새 코드를 적용했다.

- MEMBER는 열린 일정 화면을 유지. HOST 00:34:25 KST 저장으로 v3→v4, MEMBER의 polling 응답 완료 00:34:29.912 KST에 v4 확인, 변경 내용 확인 action 표시. 30초 budget 내 관찰이다. fetch wrapper는 시각과 revision만 기록했고 응답/정책을 바꾸지 않았다.
- HOST 두 탭에서 같은 v3로 수정. 첫 탭의 숙소 메모 저장→v4. 두 번째 탭은 교통 메모를 편집한 상태에서 save 409, 최신 GET만 실패 주입. [입력 보존](../../../assets/ui-ux-closure/editor-refetch-preserved-320.png). 첫 메모와 기존 기준이 남고 최신 조회 실패가 명시됨.
- 실패 해제 후 다시 저장→v3→v4 conflict/rebase 안내, 다른 탭의 숙소 메모와 내 교통 메모 둘 다 보존→사용자가 재저장→서버 v5에서 두 값 확인. UXF-005 재검증 완료.
- MEMBER가 v4 변경 drawer를 열고 있는 동안 HOST가 v5 저장. 확인하기가 최신 변경을 확인한 것으로 처리되지 않고 v5 내용을 재확인하도록 안내. [충돌](../../../assets/ui-ux-closure/acknowledgement-conflict-390.png).
- 확인 요청도 network abort를 주입해 실패 안내/열린 drawer 유지, 해제 후 재시도→서버 acknowledgedRevision 5 확인.
- 비로그인 private GET 401 UNAUTHORIZED, HOST가 비참여 MEMBER 소유 방 조회는 404 NOT_FOUND, MEMBER의 유효한 itinerary PATCH는 403 FORBIDDEN. 최초 불완전 PATCH의 400은 권한 증거에서 제외했다.

추가 matrix 실행은 사용자 요청으로 중단. 남은 세부 범위: 이미 참여/만료 초대 각각의 실제 흐름, 의견·확정 5xx, 모든 back/forward 조합과 서로 다른 의견/가격·인원 비교 데이터. 기존 서버/단위/컴포넌트 검사는 이를 실제 브라우저 통과로 대신하지 않는다.
