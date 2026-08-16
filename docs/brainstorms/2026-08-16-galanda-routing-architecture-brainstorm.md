---
date: 2026-08-16
topic: galanda-routing-architecture
status: confirmed
source: ./2026-08-14-galanda-screen-flow-brainstorm.md
---

# 갈란다 라우팅 아키텍처 결정

## 1. 문서 목적

이 문서는 갈란다 WebView 미니앱의 URL 구조, 화면 전환, 딥링크와 뒤로가기 원칙을 정의한다. 화면의 역할과 사용자 흐름은 [화면 흐름 및 화면 명세](./2026-08-14-galanda-screen-flow-brainstorm.md), 애플리케이션 계층은 [Effect-first 아키텍처 결정](./2026-08-16-galanda-effect-first-architecture-brainstorm.md)을 따른다.

## 2. 선택

라우터는 **`react-router-dom` v7**을 라이브러리 방식으로 사용한다.

- `BrowserRouter`, `Routes`, `Route`, `Navigate`, `Outlet`을 사용한다.
- 앱인토스 Web Framework는 SDK와 호스트 브리지 역할만 담당하며 별도 Router로 감싸지 않는다.
- React Router의 loader와 action은 사용하지 않는다. 데이터 로딩과 mutation은 TanStack Query와 Effect가 담당한다.
- 경로, query와 딥링크에서 받은 값은 신뢰 경계로 취급하고 Effect Schema로 검증한다.
- URL과 별도의 React state로 현재 페이지를 중복 관리하지 않는다.
- 앱인토스 딥링크가 pathname을 사용하므로 `HashRouter`는 사용하지 않는다.

현재 `App.tsx`의 `useState` 기반 샘플 화면 전환은 실제 화면을 구현할 때 Router로 교체한다.

## 3. 경로 규칙

- 경로는 영문 소문자 복수 명사를 사용한다.
- 화면 ID(`PL-01` 등)는 기획 문서 식별자이며 실제 URL에 포함하지 않는다.
- 공유하거나 새로고침해도 같은 화면을 복원해야 하는 상태만 URL에 둔다.
- 탭, 상세 화면과 비교 대상처럼 사용자 탐색에 영향을 주는 상태는 경로 또는 query로 표현한다.
- 바텀시트, 토스트와 일시적인 입력 UI 상태는 URL에 넣지 않는다.

## 4. MVP 경로 표

| 경로 | 화면 | 동작 |
|---|---|---|
| `/` | 진입점 | `/trips`로 `replace` |
| `/trips` | `TR-01` 여행 목록 | 참여 중인 여행 목록 |
| `/trips/new` | `TR-02` 여행방 만들기 | 여행방과 첫 여행안 생성 시작 |
| `/invites/:inviteToken` | `IN-01` 초대장 | 로그인 전 최소 초대 정보 표시 |
| `/trips/:tripId` | 여행방 진입점 | 미확정이면 `plans`, 확정이면 `itinerary`로 `replace` |
| `/trips/:tripId/plans` | `PL-01` 계획 탭 홈 | 계획 현황과 여행안 목록 |
| `/trips/:tripId/plans/new` | `PL-03` 여행안 편집 | 기본안 또는 새 대안 작성 |
| `/trips/:tripId/plans/:planId` | `PL-02` 여행안 상세 | 여행안 검토와 의견 작성 |
| `/trips/:tripId/plans/:planId/edit` | `PL-03` 여행안 편집 | 작성자의 임시 수정본 편집 |
| `/trips/:tripId/plans/compare?left=:planId&right=:planId` | `PL-04` 여행안 비교 | 두 공개 여행안 비교 |
| `/trips/:tripId/itinerary` | `IT-01` 일정 탭 홈 | 확정 일정 확인 |
| `*` | 찾을 수 없음 | 오류 설명과 `/trips` 이동 제공 |

`left`와 `right`는 비교 화면을 다시 열거나 공유해도 같은 두 여행안을 복원하기 위해 query에 둔다. 두 값이 없거나 같거나 접근할 수 없는 여행안이면 임의의 기본값으로 조용히 바꾸지 않고 비교 대상을 다시 선택하도록 안내한다.

## 5. 레이아웃과 탭

여행방 경로는 URL 계층을 공유하지만 모든 하위 화면에 같은 UI를 강제하지 않는다.

- `TripRoomTabLayout`: `PL-01`과 `IT-01`에 여행방 상단 정보와 `계획 | 일정` 탭을 제공한다.
- `TripRoomChildLayout`: `PL-02`, `PL-03`, `PL-04`에 뒤로가기와 화면 제목만 제공하고 탭은 반복하지 않는다.
- 계획과 일정 탭 전환은 같은 여행방의 형제 경로로 이동한다.
- 반복 탭 전환이 history를 쌓지 않도록 탭 이동은 기본적으로 `replace`한다.
- 카드 선택, 새 여행안 작성과 비교 진입 같은 전진 탐색은 history에 `push`한다.

`/trips/:tripId`에서는 여행방 상태를 TanStack Query와 Effect로 조회한 뒤 기본 탭을 결정한다. 자동 이동은 history에 중간 경로를 남기지 않도록 `replace`한다.

## 6. Route와 데이터 계층의 경계

Router는 URL을 화면에 연결할 뿐 데이터를 직접 가져오거나 변경하지 않는다.

```text
React Router
  -> feature route adapter
  -> Effect Schema로 params/query 검증
  -> TanStack Query queryFn/mutationFn
  -> ManagedRuntime
  -> Effect Use Case
```

- `tripId`, `planId`, `inviteToken`, `left`, `right`를 사용하기 전에 Schema로 decode한다.
- decode된 식별자는 Brand 타입으로 Use Case에 전달한다.
- 잘못된 경로 값은 네트워크 요청 전에 route 오류 화면으로 처리한다.
- React Router loader/action과 TanStack Query에 같은 요청을 중복 정의하지 않는다.
- route 컴포넌트는 Supabase 또는 LocalStorage 구현체를 알지 못한다.

## 7. 인증과 권한

- `/invites/:inviteToken`은 로그인 전 접근할 수 있으며 여행 제목과 초대한 사람 등 허용된 최소 정보만 표시한다.
- `inviteToken`은 여행방 ID나 사용자 정보를 포함하지 않는 추측하기 어려운 불투명 토큰으로 발급하고 폐기할 수 있어야 한다.
- `/trips/**`는 인증된 사용자를 요구한다.
- 인증이 필요하면 현재 목적지를 보존하고 토스 로그인 완료 후 해당 경로로 `replace`한다.
- 목적지는 애플리케이션 내부 경로만 허용하며 외부 URL을 redirect 대상으로 사용하지 않는다.
- 화면 진입 가능 여부를 UI guard만으로 보장하지 않는다. 실제 데이터 접근 권한은 Supabase JWT와 RLS가 최종 검증한다.
- 존재하지 않는 여행과 접근할 수 없는 여행을 외부 사용자에게 과도하게 구분해 노출하지 않는다.

## 8. 딥링크와 공유 링크

초대 링크는 canonical route와 같은 경로를 사용한다.

```text
웹 경로:          /invites/:inviteToken
운영 딥링크:      intoss://galanda/invites/:inviteToken
```

`getTossShareLink`에는 운영 딥링크를 전달한다. 출시 전에는 업로드 시 발급된 `intoss-private://` 테스트 스킴과 `_deploymentId`를 사용한다.

공유 링크는 앱 내부 이동뿐 아니라 Sandbox의 cold start에서도 같은 화면을 열어야 한다. canonical route마다 직접 진입 테스트를 수행한다.

React Router의 현재 location을 앱 내부 탐색의 기준으로 사용한다. 최초 유입 스킴 자체가 필요한 분석이나 진단에는 `Environment.initialURL`을 사용하며, deprecated된 `getSchemeUri`를 새 코드에서 사용하지 않는다.

## 9. 뒤로가기

- 앱 내부 상단 뒤로가기는 React Router history의 직전 화면으로 이동한다.
- 직접 딥링크로 진입해 앱 내부 이전 화면이 없으면 임의의 상위 화면을 만들지 않고 `closeView()`로 미니앱을 닫는다.
- 브라우저, Android 시스템 뒤로가기와 iOS 스와이프는 같은 history를 기준으로 동작하게 한다.
- 전역에서 `backEvent`를 항상 가로채지 않는다.
- 저장하지 않은 편집 내용처럼 이탈 확인이 필요한 화면에서만 `graniteEvent.backEvent`를 구독하고 언마운트 시 반드시 해제한다.
- 이탈 확인 중에는 필요한 범위에서만 iOS 스와이프 뒤로가기를 끄고 화면을 떠날 때 다시 켠다.

history에 내부 이전 화면이 있는지는 앱 세션의 Router 이동 기록으로 판단하며 `window.history.length`만 신뢰하지 않는다.

## 10. Mutation 이후 이동

- 여행방 생성 성공: 생성된 `/trips/:tripId`로 `replace`하여 폼 재제출을 막는다.
- 여행안 공개 또는 편집 완료: 해당 여행안 상세 또는 계획 홈으로 이동하고 관련 query를 invalidate한다.
- 여행안 삭제: 계획 홈으로 `replace`한다.
- 여행안 확정: `/trips/:tripId/itinerary`로 `replace`하고 계획 기록은 계획 탭에서 계속 접근할 수 있게 한다.
- mutation 실패 시 현재 경로와 입력 상태를 유지한다.

이동은 mutation 성공 후에만 수행한다. Router가 mutation 성공을 추측하거나 URL 변경만으로 서버 상태를 바꾸지 않는다.

## 11. 구현 위치

초기에는 route 선언을 `src/app/router.tsx` 한 곳에 둔다. 각 페이지 컴포넌트와 route parameter adapter는 해당 `src/features/**` 안에 둔다.

화면 수가 실제로 커지기 전에는 파일 기반 라우팅, route 코드 생성, feature별 Router 또는 별도 navigation state store를 추가하지 않는다.

## 12. 참고 자료

- [앱인토스 WebView 피처 주소](https://developers-apps-in-toss.toss.im/development/test/function.html)
- [앱인토스 미니앱 공유 링크](https://developers-apps-in-toss.toss.im/documentation/common/growth/share/miniapp-share-link)
- [앱인토스 iOS 스와이프 뒤로가기](https://developers-apps-in-toss.toss.im/documentation/sdk/domains-api/screen/screen.setiosswipeback)
- [React Router 문서](https://reactrouter.com/)
