# Implementation Plan: Toss Liquid Glass UI Refresh

## Overview

현재 TypeScript/React UI architecture를 유지하면서 semantic foundation을 먼저 확립하고, shadcn/Base UI primitive와 Galanda composition, platform shell, Covered Flow 순서로 UI refresh를 점진 적용한다. 각 단계는 앞 단계의 token과 contract를 재사용하며, 마지막에 Web/PWA·Apps in Toss browser evidence matrix와 canonical gate로 전체 결과를 검증한다. API, domain, authentication/authorization, persistence, optimistic concurrency 계약은 변경하지 않는다.

## Tasks

- [x] 1. Foundation token과 전역 정적 계약을 확립한다
  - [x] 1.1 `src/index.css`와 `src/app/layouts/AppRootLayout.tsx`의 semantic foundation을 갱신한다
    - 대상 경계: role-based content/chrome/overlay surface, border, elevation, blur, saturation, motion, 44px target, 720px content width token과 `@theme inline` alias만 추가하고 기존 shadcn token 호환성을 유지한다.
    - `html`, `body`, `#root`, app root가 `--background`와 `100vh`/`100dvh` fallback을 사용하게 하고 stale `--adaptiveBackground` 참조를 제거한다.
    - opaque surface/filter `none`을 기본값으로 두고 `@supports` 안에서 Common Chrome/Overlay만 glass로 강화한다. 모든 duration은 300ms 이하로 제한하고 reduced motion에서 transform/zoom/slide/smooth scroll/spinner motion을 제거하되 정적 상태 표현은 유지한다.
    - 기대 결과: Tailwind와 Emotion이 같은 CSS custom property를 소비하고, root 배경·fallback·motion이 브라우저 기능과 무관하게 안정적으로 동작한다.
    - Focused test/validation: 1.2의 static contract test를 실행하고 `pnpm build:web`으로 Tailwind alias와 CSS build를 검증한다.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 3.1, 3.2, 3.3, 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 1.2 `src/ui-refresh-contract.test.ts`에 foundation/static contract tests를 작성한다
    - required token과 `@theme inline` alias, root의 stale token 제거, opaque-first `@supports`, reduced-motion override, 300ms duration 상한을 source contract로 검증한다.
    - backdrop filter가 `src/index.css`의 허용 selector와 `src/components/galanda` Common Chrome 및 `src/components/ui` Overlay 밖으로 확산되지 않는지 검사한다.
    - feature/app의 `@base-ui/react` 직접 import, `src/platform/ait/**` 밖의 `@apps-in-toss/*` import, TDS import/dependency, 신규 UI runtime asset/design-system dependency가 없음을 `package.json`과 source tree로 검증한다.
    - 기대 결과: architecture와 progressive-enhancement 제한이 이후 flow 변경에도 자동으로 회귀 검출된다.
    - Focused test/validation: `pnpm exec vitest run src/ui-refresh-contract.test.ts`.
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 3.3, 6.8, 8.1, 8.2, 8.4, 8.7, 8.8, 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 2. shadcn/Base UI primitive의 접근성·chrome·motion 계약을 갱신한다
  - [x] 2.1 `src/components/ui/button.tsx`, `input.tsx`, `textarea.tsx`, `field.tsx`, `label.tsx`를 갱신한다
    - 모든 interactive button size의 hit box를 최소 44×44px로 만들되 compact glyph 크기는 분리하고, form control은 viewport와 무관하게 16px 이상을 유지한다.
    - permanent label/legend와 placeholder 역할, focus-visible ring, pending/disabled/`aria-busy` 표현을 보존하며 제품 문구나 domain state를 primitive에 추가하지 않는다.
    - 기대 결과: 모바일 overflow 없이 공통 touch/form 기준이 primitive에서 일관되게 적용된다.
    - Focused test/validation: 2.5의 primitive component test와 `pnpm typecheck`를 실행한다.
    - _Requirements: 1.4, 1.5, 4.3, 4.5, 5.1, 5.5, 5.6, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [x] 2.2 `src/components/ui/tabs.tsx`에 content/default와 Mode Tab용 `chrome` variant를 분리한다
    - default tabs는 opaque content filter로 유지하고, `chrome` variant만 chrome surface/filter/elevation token을 소비하게 한다.
    - `TabsTrigger`는 최소 44px 높이, 긴 label reflow, Base UI의 selected state와 `aria-selected`를 유지한다.
    - 기대 결과: 여행 목록 filter tab에는 glass가 적용되지 않고 여행방 Mode Tab에만 glass 역할이 적용된다.
    - Focused test/validation: 2.5의 Tabs test와 기존 `src/app/layouts/TripRoomTabLayout.test.tsx`를 실행한다.
    - _Requirements: 3.3, 3.6, 4.4, 5.1, 6.7, 7.4, 7.7_

  - [x] 2.3 `src/components/ui/drawer.tsx`와 `alert-dialog.tsx`의 Overlay surface와 transition을 갱신한다
    - overlay/content에는 overlay role token과 opaque fallback을 적용하고, dense form/list inner content는 불투명하게 유지한다.
    - 기존 Base UI role/title/description, modal focus trap, Escape dismiss, focus restoration, background scroll lock을 보존한다.
    - Drawer의 450ms transition을 overlay/content 각각 최대 200/280ms로 줄이고 reduced motion에서는 animation 없이 같은 open/closed state와 keyboard-aware footer를 유지한다.
    - 기대 결과: backdrop 지원/fallback 양쪽에서 동일한 위계와 접근성을 가지며 모든 Overlay motion이 300ms 이하이다.
    - Focused test/validation: 2.6의 Overlay component test와 `pnpm typecheck`를 실행한다.
    - _Requirements: 3.1, 3.3, 7.6, 7.7, 7.9, 7.10, 8.1, 8.2, 8.4, 8.5, 10.1, 10.2, 10.3, 10.4_

  - [x] 2.4 `src/components/ui/spinner.tsx`와 `sonner.tsx`의 상태·motion 표현을 갱신한다
    - loading icon과 toast chrome이 semantic token을 사용하게 하고, reduced motion에서는 회전을 멈추되 loading/success/error text와 live announcement를 유지한다.
    - 서버 resolve 이전 success를 만들거나 기존 announcement를 중복 읽게 하는 새 live region을 추가하지 않는다.
    - 기대 결과: motion preference와 무관하게 실제 System State가 텍스트와 보조 기술에 남는다.
    - Focused test/validation: 2.5의 reduced-motion/static state test와 `pnpm typecheck`를 실행한다.
    - _Requirements: 2.5, 7.11, 8.2, 8.3, 9.1, 9.7, 9.8_

  - [x] 2.5 `src/components/ui/ui-refresh.test.tsx`에 Button, form, Tabs, Spinner/Sonner component tests를 작성한다
    - 44px target class/contract, 16px input/textarea, permanent label 연결, visible focus, default/chrome Tabs 분리, selected/`aria-selected`, reduced-motion에서도 남는 상태 text를 검증한다.
    - 320px 폭의 긴 action/tab label fixture로 whole-page overflow를 유발하지 않는 class/DOM 계약을 검증한다.
    - 기대 결과: primitive 수준의 typography, target, state, tab accessibility 회귀가 flow test보다 먼저 검출된다.
    - Focused test/validation: `pnpm exec vitest run src/components/ui/ui-refresh.test.tsx`.
    - _Requirements: 3.6, 4.3, 4.4, 4.5, 5.1, 5.6, 7.4, 7.6, 7.7, 7.8, 8.2, 8.3_

  - [x] 2.6 `src/components/ui/overlay.test.tsx`에 Drawer/AlertDialog accessibility와 fallback tests를 작성한다
    - role/title/description, Escape, focus trap과 opener focus restoration, scroll lock, keyboard-aware footer, pending/error content 유지 동작을 검증한다.
    - glass selector와 opaque fallback, 최대 300ms duration, reduced-motion의 즉시 상태 변경을 정적/컴포넌트 계약으로 함께 검증한다.
    - 기대 결과: visual refresh가 Base UI behavior를 약화시키지 않고 Overlay 내부 실패 상태가 닫히거나 success로 오인되지 않는다.
    - Focused test/validation: `pnpm exec vitest run src/components/ui/overlay.test.tsx`.
    - _Requirements: 7.9, 7.10, 7.11, 8.1, 8.2, 8.4, 8.5, 10.1, 10.2, 10.3, 10.4, 10.6_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Foundation/primitive focused tests와 `pnpm typecheck`가 통과한 뒤 composition 작업을 시작한다.

- [x] 4. Galanda 공통 composition을 역할 기반 shell로 갱신한다
  - [x] 4.1 `page-header.tsx`, `bottom-action.tsx`, `page-body.tsx`의 chrome/content geometry를 갱신한다
    - `PageHeader`는 opaque-first chrome, 식별 가능한 border, 720px centered inner grid, 좌우 최소 44px slot을 사용하고 bar title은 heading이 아닌 상태를 유지한다.
    - `BottomAction`은 fixed chrome, 단일 safe-bottom owner, 불투명 action button, accessory 영역을 제공하고 `PageBody withBottomAction`은 실제 CTA/safe area를 포함한 padding과 `scroll-padding-bottom`을 제공한다.
    - `PageBody`는 width 100%, max-width 720px, centered content와 header가 없을 때만 safe-top을 소유하며 viewport resize 시 children을 remount하지 않는다.
    - 기대 결과: 320px부터 desktop까지 마지막 focusable content, fixed CTA, safe area가 겹치지 않고 Content Surface는 opaque로 남는다.
    - Focused test/validation: 4.4의 geometry test와 `pnpm typecheck`를 실행한다.
    - _Requirements: 3.2, 3.4, 3.5, 3.7, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 7.4_

  - [x] 4.2 `src/components/galanda/page-state.tsx`와 `src/features/common/RouteErrorFallback.tsx`의 System State 표현을 갱신한다
    - loading은 status/live text, empty는 성공한 0건 상태, error는 alert와 가능한 retry로 배타적으로 표현하고 16px 이상 text와 semantic state token을 사용한다.
    - mutation success/error, revision conflict, authorization 등 feature-owned 의미를 재분류하지 않고 spinner가 멈춰도 상태 text가 남게 한다.
    - 기대 결과: 공통 상태가 실제 query/error 결과와 일치하고 screen reader에 중복 없이 전달된다.
    - Focused test/validation: 4.5의 PageState test와 `src/features/common/__tests__/error-message.test.ts`를 실행한다.
    - _Requirements: 2.5, 4.3, 7.7, 7.11, 8.3, 9.1, 9.2, 9.3, 9.4, 9.7, 9.8_

  - [x] 4.3 `mobile-list.tsx`, `page-title.tsx`, `section-header.tsx`의 list/heading/long-text 계약을 갱신한다
    - entity collection은 list/listitem 의미를 유지하고 전체 row action을 실제 Link/button 및 최소 44px target으로 제공한다.
    - `PageTitle` h1, section h2, card h3의 DOM 순서와 title/body/helper hierarchy를 유지하고 긴 한글·URL·destination·author·amount는 `min-width:0`과 wrap/detail access로 보존한다.
    - 기대 결과: 목록 중심 정보 위계가 모든 flow에서 재사용되고 200% zoom과 320px 폭에서 과업 필수 정보가 잘리지 않는다.
    - Focused test/validation: 4.5의 list/heading/long-text tests와 `pnpm typecheck`를 실행한다.
    - _Requirements: 1.2, 4.1, 4.2, 4.4, 4.6, 4.7, 5.1, 5.6, 7.4, 7.5, 7.7, 7.8_

  - [x] 4.4 `src/components/galanda/page-chrome.test.tsx`에 header/body/action geometry tests를 작성한다
    - sticky/bordered/chrome role, Web safeTop과 explicit topInset의 배타성, 720px inner column, reserved action slots를 검증한다.
    - fixed BottomAction, accessory 위치, safe-bottom 단일 적용, `PageBody withBottomAction`의 CTA clearance/scroll padding을 검증한다.
    - 기대 결과: safe area, content width, CTA overlap 회귀가 platform/feature 적용 전에 검출된다.
    - Focused test/validation: `pnpm exec vitest run src/components/galanda/page-chrome.test.tsx`.
    - _Requirements: 3.4, 3.5, 5.2, 5.3, 5.4, 5.5, 7.4_

  - [x] 4.5 `src/components/galanda/page-content.test.tsx`에 PageState, MobileList, heading tests를 작성한다
    - loading/empty/error의 배타적 role과 live announcement, retry 유무, reduced-motion loading text를 검증한다.
    - semantic list/listitem, 44px row action, h1→h2→h3 outline, 긴 문자열 wrap와 visible accessible text를 검증한다.
    - 기대 결과: common status와 information hierarchy가 flow별 스타일 변경에도 유지된다.
    - Focused test/validation: `pnpm exec vitest run src/components/galanda/page-content.test.tsx`.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 7.4, 7.7, 7.11, 8.3, 9.1, 9.2, 9.3, 9.4_

- [x] 5. Web/PWA와 Apps in Toss platform shell 소유권을 보존한다
  - [x] 5.1 `TripRoomTabLayout.tsx`, `TripRoomChildLayout.tsx`, `trip-room-navigation.ts`를 새 composition contract에 연결한다
    - Web/PWA는 web PageHeader의 back/title/top action과 safeTop을 소유하고, AIT는 native navigation의 back/title/accessory와 resolved content inset을 소유하게 유지한다.
    - AIT에서 native inset은 `PageHeader topInset`에 한 번만 적용하고 `safeTop=false`를 유지하며, Mode Tab은 native navigation 아래 web `TabsList variant="chrome"`로 남긴다.
    - accessory 등록 실패 시 같은 reserved right slot에 web share fallback을 표시하되 navigation owner를 바꾸거나 AIT SDK type/import를 app/feature로 노출하지 않는다.
    - 기대 결과: 두 platform이 동일 token/state 의미를 쓰면서 header/inset/accessory를 중복 렌더하지 않는다.
    - Focused test/validation: 기존 `TripRoomTabLayout.test.tsx`, `trip-room-navigation.test.ts`, `src/platform/ait/adapter.test.ts`를 실행한다.
    - _Requirements: 3.6, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 11.7_

  - [x] 5.2 `trip-room-navigation.test.ts`에 Correctness Property 2를 구현한다
    - **Property 2: Native Content Inset 정규화**
    - finite positive measured inset, zero/negative/NaN/infinity measured inset, valid fallback을 deterministic generator로 최소 100개 생성해 `toContentTopInset`의 exact/fallback 선택을 검증한다.
    - companion shell assertion으로 resolved inset이 적용될 때 Web safe-top이 더해지지 않음을 검증하고 고정 seed/counterexample을 출력한다.
    - 기대 결과: native inset 정규화와 단일 소비 계약이 임의 유효 입력에서도 유지된다.
    - Focused test/validation: `pnpm exec vitest run src/app/layouts/trip-room-navigation.test.ts`.
    - **Validates: Requirements 5.4, 6.5**

  - [x] 5.3 `TripRoomTabLayout.test.tsx`와 `src/platform/ait/adapter.test.ts`의 platform integration tests를 확장한다
    - Web back/title/share, AIT native ownership, inset 단일 적용, accessory reject 시 reserved web share fallback, Mode Tab의 native-navigation-below 위치와 `aria-selected`를 검증한다.
    - app/feature가 PlatformAdapter만 소비하고 AIT SDK 경계가 누출되지 않는지는 1.2 static contract와 함께 실행한다.
    - 기대 결과: Web/PWA와 AIT의 navigation 차이가 visual refresh 이후에도 기존 platform contract대로 유지된다.
    - Focused test/validation: `pnpm exec vitest run src/app/layouts/TripRoomTabLayout.test.tsx src/platform/ait/adapter.test.ts src/ui-refresh-contract.test.ts`.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 7.7, 11.7_

- [x] 6. 로그인·초대·여행 목록·여행 생성 flow를 작은 단위로 refresh한다
  - [x] 6.1 `src/features/auth/LoginPage.tsx`를 공통 token/shell에 연결한다
    - opaque content, PageTitle hierarchy, safe area, 16px body, 44px primary CTA를 적용하고 platform별 sign-in label 및 실제 pending/error branch를 유지한다.
    - 기대 결과: 로그인은 server/auth state를 앞서지 않으면서 다른 entry flow와 같은 action/state 역할을 사용한다.
    - Focused test/validation: 6.5의 LoginPage component test와 `pnpm typecheck`를 실행한다.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.5, 4.2, 4.3, 5.1, 5.4, 7.4, 7.11, 9.1, 9.3, 9.5, 9.6, 9.8_

  - [x] 6.2 `src/features/invite/InvitePage.tsx`를 공통 list/state/form/action composition에 연결한다
    - invite summary는 opaque list surface, nickname은 permanent label과 16px control, CTA는 glass BottomAction으로 표현한다.
    - nickname sessionStorage, anonymous sign-in, alreadyJoined, loading/error/success 분기와 실패 시 입력 보존을 변경하지 않는다.
    - 기대 결과: 초대의 상태·입력·primary completion condition이 한 화면에서 명확하며 fake/default entity가 생기지 않는다.
    - Focused test/validation: 6.5의 InvitePage component test와 `pnpm typecheck`를 실행한다.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.1, 4.3, 4.5, 5.1, 5.5, 7.4, 7.11, 9.1, 9.3, 9.5, 9.6, 9.7, 9.8, 9.9, 9.12_

  - [x] 6.3 `src/features/trip-list/TripListPage.tsx`를 PageTitle, opaque filter Tabs, MobileList, BottomAction으로 정렬한다
    - ongoing/past 계산과 정보 순서를 유지하고 collection을 list 중심으로 표현하며 filter tabs에는 default opaque variant만 사용한다.
    - loading/empty/error/retry와 create Primary Action을 실제 query state에 따라 유지하고 긴 trip title/destination을 wrap한다.
    - 기대 결과: 목록과 상태가 화면 폭/zoom에 따라 reflow하면서 동일한 System State 의미를 유지한다.
    - Focused test/validation: 6.6의 TripListPage component test와 `pnpm typecheck`를 실행한다.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.5, 3.2, 4.1, 4.2, 4.4, 5.1, 5.6, 7.4, 9.1, 9.2, 9.3, 9.4, 9.12_

  - [x] 6.4 `src/features/trip-create/TripCreatePage.tsx`만 국소 조정해 web header, form, BottomAction을 통합한다
    - permanent label, 16px control, completion condition accessory, pending action label과 duplicate-submit guard를 적용한다.
    - 기존 title validation, mutation command, 성공 응답 이후 route 이동과 실패 시 입력/error 보존을 유지하고 `mutations.ts`의 API contract는 변경하지 않는다.
    - 기대 결과: 여행 생성은 server-confirmed success만 표시하고 fixed CTA와 keyboard가 form 접근을 막지 않는다.
    - Focused test/validation: 6.6의 TripCreatePage component test와 `pnpm typecheck`를 실행한다.
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 4.3, 4.5, 5.3, 5.5, 7.4, 7.11, 9.5, 9.6, 9.7, 9.8, 9.9, 11.5_

  - [x] 6.5 `LoginPage.test.tsx`와 `InvitePage.test.tsx`에 entry flow component tests를 작성한다
    - pending/error/server success, platform label, alreadyJoined, permanent nickname label, duplicate guard, failure input preservation, accessible names/status announcement를 검증한다.
    - 320px long-text fixture와 keyboard DOM order를 포함하되 auth/domain/network implementation을 mock으로 재정의하지 않는다.
    - 기대 결과: entry flow의 실제 상태와 form accessibility 회귀가 자동 검출된다.
    - Focused test/validation: `pnpm exec vitest run src/features/auth/LoginPage.test.tsx src/features/invite/InvitePage.test.tsx`.
    - _Requirements: 1.3, 1.5, 4.3, 4.4, 4.5, 5.1, 7.5, 7.7, 7.11, 9.1, 9.3, 9.5, 9.6, 9.7, 9.8, 9.9_

  - [x] 6.6 `TripListPage.test.tsx`와 `TripCreatePage.test.tsx`에 list/create component tests를 작성한다
    - ongoing/past/empty/error/retry의 배타성, opaque filter tab, semantic list, long title wrap와 유일한 Primary Action을 검증한다.
    - create validation accessory, pending label/`aria-busy`, duplicate-submit 차단, failure input 유지, server resolve 이후 navigation만 허용하는지 검증한다.
    - 기대 결과: 여행 조회·생성 UI가 기존 query/mutation 의미를 바꾸지 않음을 보호한다.
    - Focused test/validation: `pnpm exec vitest run src/features/trip-list/TripListPage.test.tsx src/features/trip-create/TripCreatePage.test.tsx`.
    - _Requirements: 1.4, 1.5, 4.1, 4.4, 7.7, 7.11, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.12_

- [x] 7. 여행안 목록의 CTA, entity provenance, list hierarchy를 refresh한다
  - [x] 7.1 `PlanHomePage.tsx`, `plan-home-view-model.ts`, `components/*`를 list/opaque content/glass action 계약에 맞춘다
    - TripSummary, candidates, decision summary를 heading/list 순서와 opaque cards로 정리하고 compare drawer 및 Primary Action chrome만 glass를 사용한다.
    - 기존 RBAC/NBA eligibility resolver와 server aggregate projection을 재사용해 primary action을 0/1개로 유지하고 completion condition을 같은 화면에 표시한다.
    - missing optional 값은 explicit pending/unknown text로 표시하며 source entity order/title/cardinality를 바꾸거나 fabricated entity를 만들지 않는다.
    - 기대 결과: actor/room state별 action과 목록이 실제 domain eligibility 및 source data에 정합한다.
    - Focused test/validation: 기존 `PlanHomePage.test.tsx`, `components/*.test.tsx`, `__tests__/plan-home-view-model.test.ts`와 7.2–7.4 tests를 실행한다.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.2, 3.7, 4.1, 4.2, 4.4, 7.4, 9.1, 9.2, 9.3, 9.12, 11.5_

  - [x] 7.2 `src/features/plan-home/plan-home-cta.property.test.ts`에 Correctness Property 1을 구현한다
    - **Property 1: 동적 Primary Action의 유일성과 권한 정합성**
    - valid TripRoom/RoomActor와 eligibility 결과를 deterministic generator로 최소 100개 생성해 `resolvePlanHomeCta`가 0/1개만 반환하고 첫 permitted action/label과 일치함을 검증한다.
    - 기존 resolver를 복제하지 않고 production resolver와 display mapping을 직접 호출하며 고정 seed/counterexample을 출력한다.
    - 기대 결과: visual priority 변경이 권한 판단 또는 CTA uniqueness를 우회하지 않는다.
    - Focused test/validation: `pnpm exec vitest run src/features/plan-home/plan-home-cta.property.test.ts`.
    - **Validates: Requirements 1.4, 11.5**

  - [x] 7.3 `src/features/plan-home/__tests__/plan-home-view-model.test.ts`에 Correctness Property 5를 구현한다
    - **Property 5: View-Model Entity Provenance**
    - valid Trip Room aggregate를 deterministic generator로 최소 100개 생성해 projected list의 cardinality, order, identity, entered title이 source와 동일함을 검증한다.
    - missing optional value는 explicit pending/unknown text만 생성하고 default entity/fabricated value는 만들지 않음을 검증하며 고정 seed/counterexample을 출력한다.
    - 기대 결과: 목록 refresh와 long-text 처리 이후에도 entity provenance가 보존된다.
    - Focused test/validation: `pnpm exec vitest run src/features/plan-home/__tests__/plan-home-view-model.test.ts`.
    - **Validates: Requirements 4.1, 9.12, 11.5**

  - [x] 7.4 기존 Plan Home component tests를 hierarchy/state/overlay 기준으로 확장한다
    - 대상: `PlanHomePage.test.tsx`, `DecisionSummarySection.test.tsx`, `PlanCandidatesHeader.test.tsx`, `PlanDecisionCard.test.tsx`, `TripSummarySection.test.tsx`.
    - DOM heading/list order, primary action 0/1개, completion condition, loading/empty/error, long title/author, compare drawer role/focus/error를 검증한다.
    - 기대 결과: 목록·CTA·Overlay의 visible/accessibility contract가 함께 보호된다.
    - Focused test/validation: `pnpm exec vitest run src/features/plan-home`.
    - _Requirements: 1.2, 1.4, 1.5, 4.1, 4.2, 4.4, 4.6, 7.5, 7.7, 7.9, 7.10, 9.1, 9.2, 9.3, 10.1, 10.6_

- [x] 8. 여행안 작성·편집 flow를 공통 editor부터 점진 적용한다
  - [x] 8.1 `src/features/plan-editor/components/*`와 `plan-editor-section.ts`의 shared editor presentation을 국소 갱신한다
    - `BasicInfoSection`, `RouteCitySection`, `AccommodationSection`, `TransportSection`, `PlanEditorSections`, `PlanEditorHeader`, `ValidationBanner`, `DiffBanner`만 semantic token/16px typography/spacing/44px target/heading hierarchy로 조정한다.
    - 기존 Emotion은 raw/legacy color를 role variable로 바꾸는 범위에 한정하고 component/state 구조를 Tailwind로 재작성하지 않는다.
    - 기대 결과: create/edit가 같은 opaque form section과 validation/conflict presentation을 재사용한다.
    - Focused test/validation: 기존 `PlanEditorSections.test.ts`와 8.4 editor tests를 실행하고 `pnpm typecheck`를 실행한다.
    - _Requirements: 1.2, 2.3, 3.2, 4.2, 4.3, 4.5, 4.6, 5.1, 5.5, 7.4, 11.3, 11.4_

  - [x] 8.2 `src/features/plan-editor/PlanCreatePage.tsx`를 PageBody/BottomAction shared editor에 연결한다
    - draft 입력과 validation message를 유지하고, Primary Action은 completion condition accessory와 pending label/duplicate guard를 갖게 한다.
    - create command/API는 변경하지 않고 server success 이후에만 success/navigation을 표시하며 실패 시 draft를 유지한다.
    - 기대 결과: 작성 flow가 fixed glass chrome과 opaque form을 사용하면서 기존 create behavior를 보존한다.
    - Focused test/validation: 8.4의 PlanCreatePage test와 `pnpm typecheck`를 실행한다.
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 3.5, 4.3, 4.5, 5.3, 5.5, 7.11, 9.5, 9.6, 9.7, 9.8, 9.9, 11.5_

  - [x] 8.3 `src/features/plan-editor/PlanEditPage.tsx`를 같은 shell에 연결하고 conflict recovery를 보존한다
    - expectedRevision, local draft, validation, refetch/reapply 선택을 그대로 유지하며 conflict accessory를 CTA 바로 위에 명시한다.
    - viewport resize/zoom에서 editor state를 remount하지 않고 mutation failure/conflict 후 입력을 보존한다.
    - 기대 결과: edit flow가 create와 같은 visual grammar를 쓰면서 optimistic concurrency 의미를 변경하지 않는다.
    - Focused test/validation: 8.4의 PlanEditPage test와 `pnpm typecheck`를 실행한다.
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 5.5, 5.6, 5.7, 7.11, 9.5, 9.6, 9.8, 9.9, 9.11, 11.5_

  - [x] 8.4 shared editor, PlanCreatePage, PlanEditPage component tests를 작성한다
    - 기존 `PlanEditorSections.test.ts`를 확장하고 `PlanCreatePage.test.tsx`, `PlanEditPage.test.tsx`를 추가한다.
    - permanent labels, heading order, long destination/URL/amount, validation accessory, pending/duplicate guard, failure draft 유지, resize rerender state 유지, conflict recovery 표시를 검증한다.
    - 기대 결과: editor visual 변경이 create command, expectedRevision 또는 local draft를 손상시키지 않는다.
    - Focused test/validation: `pnpm exec vitest run src/features/plan-editor`.
    - _Requirements: 1.5, 4.3, 4.4, 4.5, 4.6, 5.5, 5.6, 5.7, 7.5, 7.7, 7.11, 9.5, 9.6, 9.8, 9.9, 9.11, 11.5_

- [x] 9. 여행안 상세·비교 flow의 opaque content와 Overlay를 refresh한다
  - [x] 9.1 `PlanDetailPage.tsx`, `plan-detail-view-model.ts`, `components/*`를 상세/list/state 계약에 맞춘다
    - title/meta/timeline/cost/risk/opinion을 opaque content와 semantic badge/list hierarchy로 정리하고 BottomAction, opinion Drawer, management Drawer, destructive AlertDialog만 glass chrome/overlay를 사용한다.
    - opinion/confirm/delete 권한, mutation pending/error/success, destructive confirmation, 입력 보존을 기존 resolver와 mutation 결과에서 가져온다.
    - unknown price는 priced/zero-entered와 구분해 `가격 미정` 및 mixed pending count로 표현하고 `0원`이나 fabricated value로 대체하지 않는다.
    - 기대 결과: 상세 정보의 가독성이 chrome보다 우선하고 모든 보조/파괴적 행동이 실제 권한·서버 상태와 일치한다.
    - Focused test/validation: 기존 `__tests__/plan-detail-view-model.test.ts`, 9.2–9.3 tests와 `pnpm typecheck`를 실행한다.
    - _Requirements: 1.1, 1.3, 1.4, 3.2, 3.7, 4.1, 4.2, 4.4, 7.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.12, 10.5, 10.6, 11.5_

  - [x] 9.2 `src/features/plan-detail/__tests__/plan-price.property.test.ts`에 Correctness Property 3을 구현한다
    - **Property 3: 미정 가격의 보존**
    - accommodation/transport price range collection을 deterministic generator로 최소 100개 생성해 missing range마다 `unpricedCount`가 증가함을 검증한다.
    - all-unpriced는 `가격 미정`, mixed는 priced range와 pending count 모두 visible, explicit zero-entered는 unknown과 구분됨을 검증하고 고정 seed/counterexample을 출력한다.
    - 기대 결과: UI formatting이 미정 가격을 0원으로 손실 변환하지 않는다.
    - Focused test/validation: `pnpm exec vitest run src/features/plan-detail/__tests__/plan-price.property.test.ts`.
    - **Validates: Requirements 9.10, 9.12**

  - [x] 9.3 Plan Detail view/component tests를 state, accessibility, Overlay 기준으로 확장한다
    - `__tests__/plan-detail-view-model.test.ts`를 확장하고 `PlanDetailPage.test.tsx`, `components/OpinionBottomSheet.test.tsx`를 추가한다.
    - unknown/mixed/zero price, long title/URL, permission별 action, pending/error/input 유지, destructive dialog 문구, role/title/Escape/focus restore/scroll lock을 검증한다.
    - 기대 결과: 상세 flow의 정보와 Overlay interaction이 서버 상태·권한·접근성 계약을 함께 유지한다.
    - Focused test/validation: `pnpm exec vitest run src/features/plan-detail`.
    - _Requirements: 4.4, 7.5, 7.7, 7.9, 7.10, 7.11, 9.5, 9.6, 9.8, 9.9, 9.10, 10.1, 10.3, 10.4, 10.5, 10.6_

  - [x] 9.4 `src/features/plan-compare/PlanComparePage.tsx`와 `components/ConfirmPlanSummaryView.tsx`를 세로 비교 구조로 갱신한다
    - whole-page horizontal table 없이 비교 section을 720px column 안에서 stack/wrap하고 title/status/value/action hierarchy를 유지한다.
    - compare selection/query와 confirm contract는 변경하지 않고 confirmation action chrome만 glass로 표현하며 unknown 값은 explicit pending text로 남긴다.
    - 기대 결과: 320px와 200% zoom에서도 모든 비교 값과 확정 action에 접근할 수 있다.
    - Focused test/validation: 기존 `__tests__/plan-compare-view-model.test.ts`, 9.5 component test와 `pnpm typecheck`를 실행한다.
    - _Requirements: 1.1, 1.3, 1.4, 3.2, 4.1, 4.2, 4.4, 5.1, 5.6, 7.4, 9.1, 9.3, 9.5, 9.6, 9.12, 11.5_

  - [x] 9.5 Plan Compare view/component tests를 responsive/state 기준으로 확장한다
    - `__tests__/plan-compare-view-model.test.ts`를 확장하고 `PlanComparePage.test.tsx`를 추가한다.
    - source selection/order, vertical DOM reading order, long values, unknown text, loading/error, confirm pending/duplicate guard/server success를 검증한다.
    - 기대 결과: 비교 reflow가 정보 손실이나 confirm contract 변경을 만들지 않는다.
    - Focused test/validation: `pnpm exec vitest run src/features/plan-compare`.
    - _Requirements: 4.1, 4.4, 4.6, 5.1, 5.6, 7.5, 7.7, 7.11, 9.1, 9.3, 9.5, 9.6, 9.7, 9.8, 9.12_

- [x] 10. 확정 일정 조회·편집 flow의 state와 conflict 처리를 refresh한다
  - [x] 10.1 `ItineraryPage.tsx`와 `itinerary-view-model.ts`를 날짜별 opaque list/timeline으로 갱신한다
    - 날짜/section/item hierarchy, semantic state badge, long hotel/route/memo wrap를 적용하고 acknowledgement 및 unknown values의 기존 의미를 유지한다.
    - loading/empty/error/success를 PageState로 배타적으로 표현하고 source itinerary item의 order/identity를 보존한다.
    - 기대 결과: 일정 조회가 좁은 폭/zoom에서 reflow하면서 실제 confirmed itinerary만 표시한다.
    - Focused test/validation: 기존 `__tests__/itinerary-view-model.test.ts`, 10.4 component test와 `pnpm typecheck`를 실행한다.
    - _Requirements: 1.1, 1.2, 1.3, 3.2, 4.1, 4.2, 4.4, 5.1, 5.6, 9.1, 9.2, 9.3, 9.10, 9.12_

  - [x] 10.2 `ItineraryEditPage.tsx`와 `itinerary-editor-state.ts`를 shared form/BottomAction/conflict contract에 연결한다
    - form/list hierarchy, permanent label, 16px controls, validation/conflict accessory, pending action label과 duplicate guard를 적용한다.
    - expectedRevision과 three-way rebase, local patch, latest fetch, explicit retry를 그대로 유지하고 실패/conflict 시 local input을 보존한다.
    - 기대 결과: 일정 편집의 visual refresh가 CAS와 rebase 동작을 바꾸지 않고 keyboard/CTA 접근성을 유지한다.
    - Focused test/validation: 기존 `ItineraryEditPage.test.ts`, 10.3–10.4 tests와 `pnpm typecheck`를 실행한다.
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 4.3, 4.5, 5.3, 5.5, 5.7, 7.11, 9.5, 9.6, 9.8, 9.9, 9.11, 11.5_

  - [x] 10.3 `ItineraryEditPage.test.ts`에 Correctness Property 4를 구현한다
    - **Property 4: Revision Conflict Three-Way Rebase**
    - compatible base/local/latest patch collection을 deterministic generator로 최소 100개 생성해 locally changed field는 local value, untouched field는 latest server value를 채택함을 검증한다.
    - identity mismatch 같은 incompatible fixture는 기존 명시적 error behavior로 분리하고 고정 seed/counterexample을 출력한다.
    - 기대 결과: conflict UI 변경과 무관하게 양방향 overwrite를 방지하는 rebase 계약이 유지된다.
    - Focused test/validation: `pnpm exec vitest run src/features/itinerary/ItineraryEditPage.test.ts`.
    - **Validates: Requirements 9.9, 9.11, 11.5**

  - [x] 10.4 Itinerary view/edit component tests를 responsive/state/conflict 기준으로 확장한다
    - `__tests__/itinerary-view-model.test.ts`를 확장하고 `ItineraryPage.test.tsx`, `ItineraryEditPage.test.tsx`를 추가한다.
    - list order/identity, long/unknown values, loading/empty/error, permanent labels, pending/duplicate guard, failure draft 유지, conflict accessory/retry, rerender state 유지를 검증한다.
    - 기대 결과: 조회·편집 flow의 실제 state, accessibility, responsive contract가 자동 보호된다.
    - Focused test/validation: `pnpm exec vitest run src/features/itinerary`.
    - _Requirements: 4.1, 4.4, 4.5, 5.1, 5.5, 5.6, 5.7, 7.5, 7.7, 7.11, 9.1, 9.2, 9.3, 9.5, 9.6, 9.8, 9.9, 9.10, 9.11, 9.12_

- [x] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Foundation, primitive, composition, platform, entry, plan, itinerary focused suites와 `pnpm typecheck`를 모두 통과시킨다.

- [x] 12. Final checkpoint - browser evidence와 canonical gate를 완료한다
  - Ensure all tests pass, ask the user if questions arise.
  - 기존 browser/AIT dev environment를 사용해 320×568, 390×844, 1440×900에서 Web/PWA, AIT native navigation, AIT accessory failure를 검증한다. 신규 browser/runtime dependency는 추가하지 않는다.
  - 각 platform/viewport에서 backdrop 지원과 강제 opaque fallback, motion no-preference/reduce, zoom 100%/200%, loading/empty/error/success/mutation pending/revision conflict를 evidence matrix에 기록한다.
  - 각 evidence는 page horizontal scroll 없음, desktop content width ≤720px/중앙 정렬, safe area/native inset 단일 적용, BottomAction clearance, 44×44px target, 16px body/form, WCAG 2.2 AA contrast, keyboard journey, Overlay focus lifecycle, screen-reader name/role/state/announcement, glass/fallback 동일 위계, local response 시작 ≤100ms, refresh-induced CLS ≤0.1을 포함한다.
  - `pnpm check`로 lint, 전체 Vitest, Drizzle check/drift, Web build, AIT build를 모두 통과시킨다.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 3.3, 3.7, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.9, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11, 9.12, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11_

## Notes

- Tasks marked with `*` are optional test-writing tasks and can be skipped for a faster implementation pass; implementation tasks are never optional.
- Property tests use existing Vitest plus deterministic fixture generators only. Each property runs at least 100 generated cases and reports a fixed seed/counterexample; no property-testing runtime dependency is added.
- Every implementation task must inspect its adjacent existing tests before editing, make only the named presentation/platform-boundary changes, then run the listed focused suite before advancing.
- Existing Emotion code receives only semantic token, typography, spacing, target-size, wrap, and duplicate-shell cleanup. A broad Tailwind migration is outside scope.
- Do not add external runtime assets/design-system dependencies, reintroduce TDS, import Base UI directly from feature/app code, expose Apps in Toss SDK outside `src/platform/ait/**`, or change domain/API/auth/persistence/concurrency contracts.
- The browser evidence matrix and successful `pnpm check` are mandatory completion gates even if optional test-writing tasks are skipped.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "2.2", "2.3", "2.4"] },
    { "id": 2, "tasks": ["2.5", "2.6", "4.1", "4.2", "4.3"] },
    { "id": 3, "tasks": ["4.4", "4.5", "5.1"] },
    {
      "id": 4,
      "tasks": [
        "5.2",
        "5.3",
        "6.1",
        "6.2",
        "6.3",
        "6.4",
        "7.1",
        "8.1",
        "9.1",
        "9.4",
        "10.1"
      ]
    },
    {
      "id": 5,
      "tasks": [
        "6.5",
        "6.6",
        "7.2",
        "7.3",
        "7.4",
        "8.2",
        "8.3",
        "9.2",
        "9.3",
        "9.5",
        "10.2"
      ]
    },
    { "id": 6, "tasks": ["8.4", "10.3", "10.4"] }
  ]
}
```
