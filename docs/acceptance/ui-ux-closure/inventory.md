# 화면·상태 inventory

`src/app/router.tsx`의 현재 route 기준. 모든 행의 실제 환경·증거는 [evidence](evidence.md), 데이터·reset은 [scenarios](scenarios.md)에 연결한다. 아래 상태는 점검 대상이며 결함 판정이 아니다. 실행 결과가 없는 상태는 미검증이다.

| ID | route | 대표 상태 / 주요 과제 | shell owner | 데이터·seed | 검증 책임 |
| --- | --- | --- | --- | --- | --- |
| AUTH | `/login` | 비로그인, 이메일 실패, 등록 후 return, guest upgrade | LoginPage | HOST/MEMBER, 비로그인 C | #126/#129 |
| INV | `/invites/:inviteToken` | 유효, 무효, 이미 참여, guest 참여 | InvitePage | HOST 발급 초대, 독립 MEMBER/C | #128 |
| HOME | `/home` | empty, 작성 중, planning, confirmed, past, 첫 조회 실패, 이전 데이터 갱신 실패 | GlobalShell | 빈 MEMBER, HOST QA 방 | #129 |
| TRIPS | `/trips` | empty, 진행/지난 여행, owner draft, 오류, 이전 데이터 | GlobalShell | HOST/MEMBER QA 방 | #127/#129 |
| CREATE | `/trips/new` | empty/invalid/pending/error, 1회 생성 | TripCreatePage | HOST, QA 방 신규 생성 | #127 |
| COMP | `/trips/:tripId/setup/companions` | 초대 전후, 미정, 권한 없음, 이미 계획 존재 | TripCompanionSetupPage | 후보 없는 HOST QA 방 | #127/#128 |
| ENTRY | `/trips/:tripId` | 계획/확정 상태별 redirect, 오류 | TripRoomEntry | QA 방 lifecycle | #129 |
| PLANHOME | `/trips/:tripId/plans` | 후보 0/1/2, 개인/전체 의견, 미정 비용, stale/error | TripRoomTabLayout | 0/1/2 후보 QA 방 | #128 |
| WIZ | `/trips/:tripId/plans/new` 및 `new/:section` | 질문, 날짜 invalid, autosave 4상태, offline, resume, review-return, 등록 실패 | TripRoomChildLayout | HOST local draft; DEV는 별도 fixture | #127 |
| DETAIL | `/trips/:tripId/plans/:planId` | 게시/확정, 내 의견 전후, 비용·예약 미정, 권한, 오류 | TripRoomChildLayout | 게시 QA 후보 | #128 |
| EDIT | `/trips/:tripId/plans/:planId/edit` 및 `edit/:section` | owner 편집, dirty/stale, 409 복구 | TripRoomChildLayout | 두 세션, 같은 revision | #127/#128 |
| COMPARE | `/trips/:tripId/plans/compare` | 후보 0/1/2, 응답 교집합, 미정 비용, HOST 확정 | TripRoomChildLayout | 두 후보와 MEMBER 의견 | #128 |
| ITIN | `/trips/:tripId/itinerary` | 미확정, 확정, 상대 변경, 미확인/확인, 갱신 실패 | TripRoomTabLayout | 확정 QA 방 | #128/#130 |
| ITINEDIT | `/trips/:tripId/itinerary/edit` | 편집, 동시 변경, conflict, 실패 복구 | TripRoomChildLayout | 확정 QA 방 두 세션 | #128 |
| EXPLORE | `/explore` | loading/empty/error, 검색·필터·복귀 | GlobalShell | 공개 QA listing 또는 공개 목록 | #129 |
| LISTING | `/explore/:listingId` | 상세·저장·가져오기, 공개 해제/원본 변경, 권한 | ExploreListingDetailPage | HOST가 공개한 QA 후보 | #129 |
| SAVED | `/me/saved` | empty, saved, 해제·실패, stale listing | GlobalShell | MEMBER가 저장한 QA listing | #129 |
| ME | `/me` | light/dark/system; logout UI 없음, 계정 경계 별도 | GlobalShell | HOST/MEMBER | #129/#130 |
| NOTFOUND | `*` | 존재하지 않는 route, 정상 복귀 | NotFoundPage | `/not-a-ux125-route`, production `/dev` | #129 |
| DEV | `/dev?preview=wizard` | normal, invalid-date, long-copy, offline, review-return, choice × draft 상태 | DevWizardPreview + 실제 WizardStepPage | URL 고정 fixture, API 없음 | #126/#130/#131 |

GlobalShell은 `/home`, `/explore`, `/trips`, `/me`, `/me/saved`만 하단 내비게이션을 소유한다. focused 화면과 Trip 내부에는 전역 nav가 없다. 초기 loading/첫 조회 실패와 기존 데이터의 background refresh/실패는 별도 판정한다.

공통 viewport: 390×844 우선, 위험 상태 320×740·360×800·430×932, 대표 desktop 1280×900. light/dark, 긴 문구, footer/overlay/날짜 입력을 위험에 따라 선택한다. 모든 상태×폭 조합을 실행했다고 주장하지 않는다.
