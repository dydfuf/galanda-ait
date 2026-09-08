# UX-04 전역 화면 — 사용자 요청으로 점검 중단

2026-09-09, staging `e56eb3e524` 및 `832cc8d574` 배포. Chrome HOST/MEMBER 독립 프로필. viewport HOST 320px / MEMBER 390px. 실제 데이터는 [scenarios](../scenarios.md).

| 항목 | 실제 확인 | 남은 범위 |
| --- | --- | --- |
| NAV-01/02 | HOST 홈의 확정 여행/다음 행동, 내 여행의 확정/작성 중 2개 방, draft 이어쓰기 | 모든 empty/past/loading 조합 |
| NAV-03 | 홈→내 여행→Trip→draft→검토→상세, refresh 복구. focused 화면에서 전역 nav 없음 | 모든 back/forward·deep-link 조합 |
| NAV-04 | 공개 목록→상세, 초기 조회 failure→한국어 오류/다시 시도→복구 | 필터/검색/스크롤 복귀 조합 |
| NAV-05 | 실제 저장 failure→원래 저장 버튼·오류 안내→재시도. 서버 saved true/saveCount 1 | 저장 해제 및 중복 해제 조합 |
| NAV-06 | 원본과 자동 동기화되지 않는 복사본 동의 후 새 여행 import, 같은 방으로 기존 여행 import. 각각 실제 다른 후보 상세 도착 | import 자체의 5xx/충돌 입력 보존 |
| NAV-07 | HOST가 자기 listing 공개 해제→saved 목록에서 제외, 상세 unavailable/탐색 복귀. 실제 import 410 LISTING_UNAVAILABLE. 재게시 LISTED revision 3으로 복구 | 원본 여행안 내용 변경 후 재게시 snapshot 비교 |
| NAV-08 | 마이 다크 선택을 keyboard Space로 변경, Escape 종료, 새로고침 후 다크 유지 | light/system 직접 왕복, 같은 프로필 계정 교체. 현재 logout UI 없음 |
| NAV-09/10 | empty saved, 실제 목록 조회 오류/복구, 무효 초대/404, 390px dark 화면 | cached refresh 실패/다른 오류·긴 제목 모든 조합 |

[다크 마이](../../../assets/ui-ux-closure/me-dark-390.png), [저장 empty](../../../assets/ui-ux-closure/saved-empty-dark-390.png), [새 여행 import](../../../assets/ui-ux-closure/import-new-trip-dark-390.png), [조회 오류](../../../assets/ui-ux-closure/explore-read-failure-dark-390.png).

등록된 테스트 actor만 사용했다. 새로운 게시/로그아웃 UI를 추가하지 않았다. 이번 전역 화면 실행에서 새 결함을 확정하지 않았으며, 미실행을 통과로 처리하지 않는다. #129는 open 유지.
