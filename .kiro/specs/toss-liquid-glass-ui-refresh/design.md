# Design Document: Toss Liquid Glass UI Refresh

## 1. 개요

Galanda의 주요 사용자 여정을 **토스식 흰 본문 surface, 강한 정보 위계, 목록 중심 UX**로 통일하고, Apple풍 Liquid Glass는 본문이 아니라 `PageHeader`, `BottomAction`, 여행방 `Mode_Tab`, `Drawer`/`AlertDialog` 같은 공통 chrome에만 절제해 적용한다.

이번 변경은 UI implementation layer의 점진적 refresh다. route, 정보 구조, 도메인 규칙, HTTP 계약, 인증·권한, persistence, optimistic concurrency 및 서버가 확정하는 `System_State` 의미는 바꾸지 않는다. 구현 순서는 `src/index.css` semantic token과 `src/components/galanda` shell을 먼저 갱신하고, 기존 feature 화면은 공통 계약을 소비하도록 국소 조정한다.

### 1.1 설계 원칙

1. **본문 우선:** 읽고 비교하고 입력하는 `Content_Surface`는 불투명한 흰색을 유지한다.
2. **역할 기반 glass:** blur 자체가 아니라 chrome의 역할이 glass 적용 여부를 결정한다.
3. **progressive enhancement:** 기본값은 접근 가능한 불투명 surface이며, 지원 브라우저에서만 투명도와 backdrop blur를 켠다.
4. **source-owned foundation:** shadcn/Base UI/Tailwind v4가 primitive의 source of truth다. feature는 Base UI를 직접 import하지 않는다.
5. **점진적 적용:** 공통 token/shell 변경 후 화면별 raw style과 예외만 조정한다. Emotion 화면의 전면 Tailwind 이관은 하지 않는다.
6. **플랫폼 소유권 보존:** Web/PWA는 web header를, AIT는 native navigation을 소유한다. AIT SDK는 `src/platform/ait/**`에 격리한다.
7. **실제 상태 보존:** server confirmation 전 success를 표시하지 않고, empty/error/loading/conflict/unknown 값을 서로 합치지 않는다.

## 2. 현재 상태와 설계 동인

현재 저장소는 `@base-ui/react` 기반 shadcn primitive, Tailwind CSS v4, Galanda composition, 기존 Emotion feature가 공존한다. 확인된 주요 설계 입력은 다음과 같다.

- `src/index.css`는 기존 color semantic token과 `@theme inline` alias를 제공한다.
- `#root`는 존재하지 않는 `--adaptiveBackground`를 참조한다. 이를 `--background`로 복구해야 한다.
- `PageHeader`, `BottomAction`, `PageBody`, `MobileList`, `PageState`가 공통 shell 역할을 이미 제공한다.
- `TripRoomTabLayout`은 Web/PWA의 back/share와 AIT native inset/accessory ownership을 분기하고, accessory 등록 실패 시 web share를 fallback한다.
- backdrop blur는 현재 Drawer/AlertDialog overlay에만 있으며, reduced-motion media query는 없다.
- Drawer transition은 450ms로 요구 상한 300ms를 넘는다.
- 일부 button/icon/tab은 36~40px이고 일부 본문·helper·desktop form control은 13~15px이므로 44px target과 16px 본문/form 기준을 공통 primitive에서 먼저 교정해야 한다.
- 기존 test는 Trip Room shell ownership, CTA 유일성, DOM 정보 순서, accessible name, conflict rebase 등을 이미 보호한다.

## 3. 아키텍처

```text
Web/PWA                         Apps in Toss
   │                                  │
   │ web safe-area                    │ native navigation + content inset
   └──────────────┬───────────────────┘
                  ▼
       src/platform PlatformAdapter
                  │
          React Router layouts
 AppRootLayout / TripRoomTabLayout / TripRoomChildLayout
                  │
          src/components/galanda
 PageHeader / BottomAction / PageBody / PageState / MobileList
                  │
           src/components/ui
 Button / Input / Tabs / Drawer / AlertDialog / Badge / Item
                  │
             src/index.css
 semantic tokens + @theme inline + progressive enhancement
                  │
         existing feature components
      Tailwind 또는 국소 Emotion var(--token)
```

서버 경계는 그대로 유지한다.

```text
React feature → TanStack Query → HTTP/JSON → Hono → Effect use case
              → domain/ports → Drizzle/Better Auth
```

UI refresh는 React 아래의 presentation과 platform integration만 수정한다. API DTO, mutation command, actor resolution, authorization, CAS revision 및 error code를 변경하지 않는다.

## 4. 구성 요소 책임

| 경계                       | 책임                                                           | 변경 방향                                                       | 금지 사항                                                 |
| -------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------- |
| `src/index.css`            | role token, safe area, motion, glass fallback, root background | token 확장, `#root` 정합성, reduced motion 추가                 | feature별 raw color를 전역에 복제                         |
| `src/components/ui/*`      | 일반 primitive와 Base UI behavior                              | 44px target, 16px form text, overlay token, motion 상한         | 앱 코드의 Base UI 직접 import, 제품 문구/도메인 상태 추가 |
| `src/components/galanda/*` | 제품 공통 composition                                          | chrome/content 역할, max width, CTA clearance, status semantics | TDS API 복제, platform SDK import                         |
| `src/app/layouts/*`        | route shell과 navigation owner 조합                            | web/AIT owner와 Mode Tab 위치 유지                              | native/web header 중복, inset 이중 적용                   |
| `src/platform/*`           | capability abstraction                                         | 기존 `PlatformNavigation` 계약 유지                             | feature로 AIT SDK type 노출                               |
| `src/features/*`           | 화면별 데이터와 과업 조합                                      | 공통 shell 사용, Emotion var token 국소 교체                    | 전면 재작성, 서버 상태 의미 재정의                        |

### 4.1 공통 composition 계약

#### `PageHeader`

- sticky 여부는 기존처럼 호출 화면이 결정한다.
- surface는 기본 opaque fallback이며 지원 환경에서 glass로 강화한다.
- header와 mode tab이 같은 chrome block에 포함되면 상위 shell만 surface를 소유하고 `PageHeader surface="none"`을 사용한다.
- web에서는 `safeTop`만 적용한다.
- AIT 여행방 shell에서는 `topInset`만 적용하고 `safeTop=false`를 유지한다.
- 내부 content grid는 `max-width: 720px`, 중앙 정렬, 좌우 각 최소 44px action slot을 사용한다.
- bar title은 heading이 아니며 본문 `h1` 소유권을 유지한다.

#### `BottomAction`

- 모바일에서 fixed, 데스크톱에서도 viewport 하단 chrome이되 내부 action 열만 최대 720px로 제한한다.
- `--safe-bottom`을 footer padding에 한 번 적용한다.
- `ResizeObserver`가 accessory와 zoom을 포함한 실제 높이를 `--app-bottom-action-height`로 올리고, `PageBody withBottomAction`은 104px fallback과 실제 높이 + 16px 중 큰 clearance를 제공한다.
- document scrolling element의 `scroll-padding-bottom`도 실제 action 높이를 사용한다.
- accessory(validation/conflict/help)는 CTA 바로 위 같은 chrome 안에 표시한다.
- glass는 shell에만 적용하며 button 자체는 불투명한 primary/secondary surface를 유지한다.

#### `Mode_Tab`

- `TabsList`에 제품 chrome 전용 variant(예: `variant="chrome"`)를 추가한다.
- standalone mode tab은 자체 surface를 소유하지만, 상위 header shell 안에서는 `surface="none"`으로 중복 elevation을 막는다.
- 이 variant만 glass token을 소비한다. 여행 목록의 content filter tab은 opaque 기본 variant를 유지한다.
- 각 `TabsTrigger`는 최소 44px 높이와 충분한 너비를 가지며 Base UI의 `aria-selected`/active state를 유지한다.
- AIT에서도 native navigation 아래 web content로 남는다.

#### `PageBody`

- 기본 content column을 `width:100%`, `max-width:720px`, `margin-inline:auto`로 통일한다.
- route가 header를 갖지 않을 때만 `safeTop`을 소유한다.
- `withBottomAction`일 때 마지막 focusable item이 CTA 위까지 올라오도록 실제 측정 높이에 따른 padding을 설정한다. scroll padding은 실제 document scrolling element가 소유한다.
- state나 form component를 remount하지 않으므로 viewport 변경 시 사용자 입력과 query state가 유지된다.

#### `PageState`

- `loading`: `aria-live="polite"` 또는 `role="status"`와 16px 이상 텍스트를 제공한다.
- `empty`: 성공한 0건 응답에서만 표시하며 alert role을 사용하지 않는다.
- `error`: `role="alert"`, 오류 설명, 가능할 때 retry action을 제공한다.
- reduced motion에서 spinner animation을 제거해도 loading text는 남는다.
- mutation success는 서버 resolve 이후 현재 toast/화면 상태로 표시하며 가짜 optimistic success를 추가하지 않는다.

#### `MobileList`, `PageTitle`, `SectionHeader`

- entity collection은 list/listitem 또는 의미가 같은 구조로 유지한다.
- 전체 row action은 실제 `Link`/`button`이며 최소 44px 높이를 충족한다.
- 긴 제목/설명은 `min-width:0`, `overflow-wrap:anywhere`, 필요한 line clamp와 상세 진입을 조합한다.
- `PageTitle`은 `h1`, section은 DOM 순서에 맞는 `h2`, 카드 내부는 `h3`를 유지한다.

### 4.2 primitive 계약

- `Button`: 모든 사용자 조작 size의 hit box는 최소 44×44px이다. compact visual이 필요하면 내부 glyph 크기만 줄이고 interactive box는 줄이지 않는다. primary는 default, secondary/outline/ghost는 보조 행동, destructive는 확인 dialog 내부 최종 행동에 사용한다.
- `Input`/`Textarea`: viewport와 관계없이 16px 이상이다. 현재 `md:text-sm` 축소를 제거한다. label은 `FieldLabel`/`legend`가 영구 제공하고 placeholder는 예시로만 사용한다.
- `Tabs`: default는 content filter, chrome variant는 Mode Tab 전용이다.
- `Drawer`/`AlertDialog`: Base UI가 제공하는 role, focus trap, Escape, focus restoration, scroll lock을 유지한다. popup에 overlay glass role token을 적용하고 dense form/list 본문은 충분히 불투명하게 유지한다.
- `Spinner`/Sonner loading icon`: reduced motion에서 회전을 멈추고 텍스트 announcement를 유지한다.

## 5. Semantic Token 계약

### 5.1 역할 모델

기존 shadcn color token은 호환성을 위해 유지하고 다음 역할 token을 추가한다. 값은 `:root`에서 한 번 정의하고 Tailwind와 Emotion이 동일한 CSS custom property를 소비한다.

| 역할                                 | CSS custom property                                                                                              | Tailwind alias/사용              | 의미                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------ |
| page background                      | `--background`                                                                                                   | `bg-background`                  | 최상위 흰 배경                       |
| opaque content                       | `--surface-content`                                                                                              | `bg-surface-content`             | list/form/detail 본문                |
| raised content                       | `--surface-raised`                                                                                               | `bg-surface-raised`              | opaque card/dialog inner content     |
| chrome active surface                | `--surface-chrome`                                                                                               | `bg-surface-chrome`              | 지원 여부에 따라 glass/fallback 선택 |
| chrome fallback                      | `--surface-chrome-opaque`                                                                                        | `bg-surface-chrome-opaque`       | backdrop 미지원 기본값               |
| overlay active surface               | `--surface-overlay`                                                                                              | `bg-surface-overlay`             | drawer/dialog popup                  |
| overlay fallback                     | `--surface-overlay-opaque`                                                                                       | `bg-surface-overlay-opaque`      | 불투명 popup fallback                |
| chrome border                        | `--border-chrome`                                                                                                | `border-border-chrome`           | 배경과 chrome 분리                   |
| overlay border                       | `--border-overlay`                                                                                               | `border-border-overlay`          | popup edge                           |
| chrome elevation                     | `--elevation-chrome`                                                                                             | `shadow-(--elevation-chrome)`    | header/action/tab depth              |
| overlay elevation                    | `--elevation-overlay`                                                                                            | `shadow-(--elevation-overlay)`   | drawer/dialog depth                  |
| chrome blur                          | `--blur-chrome`                                                                                                  | `backdrop-blur-(--blur-chrome)`  | common chrome blur 역할              |
| overlay blur                         | `--blur-overlay`                                                                                                 | `backdrop-blur-(--blur-overlay)` | popup/backdrop blur 역할             |
| saturation                           | `--saturation-chrome`                                                                                            | CSS var                          | blur 환경 색 분리                    |
| instant/fast/standard/overlay motion | `--motion-duration-instant`, `--motion-duration-fast`, `--motion-duration-standard`, `--motion-duration-overlay` | `duration-(--...)`               | 0/100/200/최대 280ms                 |
| standard/decelerate easing           | `--motion-ease-standard`, `--motion-ease-decelerate`                                                             | `ease-(--...)`                   | local/state/overlay timing           |
| touch target                         | `--touch-target-min`                                                                                             | `min-h-(--touch-target-min)`     | 44px                                 |
| content width                        | `--content-max-width`                                                                                            | `max-w-(--content-max-width)`    | 720px                                |

`surface`, `border`, `elevation`, `blur`, `saturation`, `motion`은 별도 token이므로 glass 강도나 그림자를 독립 조정할 수 있다. opaque fallback은 glass token과 별도 이름으로 유지해 지원 여부에 따라 예측 가능하게 선택한다.

### 5.2 `@theme inline`과 Emotion

`@theme inline`에는 color/spacing/radius뿐 아니라 필요한 shadow/blur/easing alias를 등록한다. 예시는 다음과 같다.

```css
@theme inline {
  --color-surface-content: var(--surface-content);
  --color-surface-raised: var(--surface-raised);
  --color-surface-chrome: var(--surface-chrome);
  --color-surface-chrome-opaque: var(--surface-chrome-opaque);
  --color-surface-overlay: var(--surface-overlay);
  --color-border-chrome: var(--border-chrome);
  --shadow-chrome: var(--elevation-chrome);
  --shadow-overlay: var(--elevation-overlay);
  --blur-galanda-chrome: var(--blur-chrome);
  --blur-galanda-overlay: var(--blur-overlay);
  --ease-standard: var(--motion-ease-standard);
}
```

기존 Emotion feature는 새 palette를 만들지 않고 같은 역할을 직접 참조한다.

```tsx
const sectionStyle = css`
  color: var(--foreground);
  background: var(--surface-content);
  border-color: var(--border);
`;
```

`apps-in-toss.config.ts`의 브랜드 자산 색은 플랫폼 metadata 예외이며, 일반 screen style로 복제하지 않는다.

### 5.3 root 정합성

`html`, `body`, `#root`, `AppRootLayout`은 모두 `--background`를 사용한다. `--adaptiveBackground` 참조는 제거한다. `min-height:100vh`와 `100dvh` fallback, `overflow-x:hidden`, flex column 계약은 유지한다.

## 6. CSS Progressive Enhancement

opaque가 기본이고 glass가 enhancement인 순서로 선언한다.

```css
:root {
  --surface-chrome: var(--surface-chrome-opaque);
  --surface-overlay: var(--surface-overlay-opaque);
  --chrome-backdrop-filter: none;
  --overlay-backdrop-filter: none;
}

@supports (
  (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))
) {
  :root {
    --surface-chrome: var(--surface-chrome-glass);
    --surface-overlay: var(--surface-overlay-glass);
    --chrome-backdrop-filter: blur(var(--blur-chrome))
      saturate(var(--saturation-chrome));
    --overlay-backdrop-filter: blur(var(--blur-overlay))
      saturate(var(--saturation-chrome));
  }
}
```

공통 chrome은 active surface와 filter 변수만 사용한다.

```css
[data-galanda-surface="chrome"] {
  background: var(--surface-chrome);
  border-color: var(--border-chrome);
  box-shadow: var(--elevation-chrome);
  -webkit-backdrop-filter: var(--chrome-backdrop-filter);
  backdrop-filter: var(--chrome-backdrop-filter);
}
```

적용 허용 대상은 다음뿐이다.

- `PageHeader`
- `BottomAction`
- Trip Room의 chrome variant `TabsList`
- `DrawerOverlay`/`DrawerContent`
- `AlertDialogOverlay`/`AlertDialogContent`
- 전역 toast처럼 화면 위에 뜨는 기존 overlay chrome(필요한 경우)

`PageBody`, `MobileList`, plan card, form section, itinerary timeline에는 backdrop filter를 적용하지 않는다.

### 6.1 Reduced Motion

모든 duration token은 300ms 이하다. Drawer의 450ms transition은 overlay/content 각각 최대 200/280ms로 변경한다. `prefers-reduced-motion: reduce`에서는 다음을 적용한다.

- transform, zoom, slide, smooth scroll을 제거한다.
- state opacity transition은 즉시 또는 1ms 이하로 바꾼다.
- spinner/loader rotation을 멈춘다.
- loading/error/success/conflict text와 live-region은 그대로 유지한다.
- drawer/dialog의 focus 이동, scroll lock, open/closed state는 animation 없이 동일하게 동작한다.

## 7. 반응형, Safe Area, 플랫폼 처리

### 7.1 Viewport 계약

| Viewport | Layout                                                                              |
| -------- | ----------------------------------------------------------------------------------- |
| 320×568  | 단일 열, 20px 이하 inline padding, fixed BottomAction, 긴 문자열 wrap, 44px targets |
| 390×844  | 단일 열, safe-area 포함, drawer keyboard-aware, fixed BottomAction                  |
| 1440×900 | 주요 content/header/action inner 열을 중앙 정렬하고 최대 720px로 제한               |

페이지 자체의 가로 scroll은 허용하지 않는다. 비교 데이터가 넓을 때도 카드/section을 세로 stack 또는 줄바꿈으로 재배치하며 whole-page horizontal table을 만들지 않는다. 텍스트 200% 확대에서도 같은 reflow 원칙을 사용한다.

### 7.2 Safe Area ownership

- header가 있는 Web/PWA route: `PageHeader`가 `--safe-top`을 소유한다.
- header가 없는 최상위 route: `PageBody safeTop`이 `--safe-top`을 소유한다.
- fixed action: `BottomAction`이 `--safe-bottom`을 소유한다.
- drawer action: `DrawerFooter`가 `--safe-bottom`과 keyboard inset을 소유한다.
- AIT Trip Room: `TripRoomTabLayout`이 `PlatformNavigation.contentTopInset`을 `PageHeader topInset`에 한 번 전달하고 `safeTop=false`로 유지한다.
- AIT native navigation이 존재하면 web back/title/native accessory를 중복 렌더하지 않는다.
- accessory 등록 실패 시 동일한 header의 예약 우측 slot에 web share를 표시하며 header owner를 바꾸지 않는다.

### 7.3 Virtual keyboard

일반 form은 `PageBody`의 bottom padding/scroll padding과 browser scroll-into-view를 사용한다. 입력이 포함된 Drawer는 기존 `keyboardAware`와 `VirtualKeyboardProvider`, `DrawerFooter` keyboard inset을 유지한다. keyboard가 열린 동안 focused field와 primary action 중 최소 하나가 현재 visual viewport에 있고, 다른 하나는 같은 scroll container에서 도달 가능해야 한다.

## 8. Screen/Feature Rollout Matrix

| Flow           | 주요 파일/경계                                  | Refresh 적용                                                               | 보존 계약                                                      |
| -------------- | ----------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 전역           | `src/index.css`, `AppRootLayout`, `App`         | token/root/motion/max-width/toast chrome                                   | router/query provider/PWA 동작                                 |
| 로그인         | `features/auth/LoginPage`                       | white content, title hierarchy, safe area, 16px body, 44px CTA             | platform별 sign-in label과 실제 pending/error                  |
| 초대           | `features/invite/InvitePage`                    | invite summary를 opaque list surface로 정리, PageState/Field/CTA 역할 통일 | nickname sessionStorage, anonymous sign-in, alreadyJoined 분기 |
| 여행 목록      | `TripListPage`                                  | `PageTitle`/opaque filter tabs/`MobileList`/glass `BottomAction`           | ongoing/past 계산, empty/error/loading 의미                    |
| 여행 생성      | `TripCreatePage`                                | web `PageHeader`, form typography, glass CTA/accessory error               | title validation, duplicate guard, 성공 후 route               |
| 여행방 shell   | `TripRoomTabLayout`, `TripRoomChildLayout`      | glass header와 Mode Tab, owner별 safe inset                                | Web back/share, AIT native owner/accessory fallback            |
| 여행안 목록    | `PlanHomePage` 및 sections/cards                | 목록 hierarchy, opaque cards, glass compare drawer/primary action          | RBAC/NBA resolver, primary 0/1개, server data                  |
| 여행안 작성    | `PlanCreatePage`, editor sections               | section heading/form token 국소 교체, glass CTA                            | draft 입력, validation, create command                         |
| 여행안 상세    | `PlanDetailPage`, timeline                      | opaque detail/list, state badge 역할, glass action/dialog/drawer           | opinion/confirm/delete 권한과 mutation 결과                    |
| 여행안 편집    | `PlanEditPage`, editor sections                 | 작성 화면과 동일 shell/token                                               | expectedRevision, 입력 보존, conflict recovery                 |
| 여행안 비교    | `PlanComparePage`                               | 세로 비교 section과 hierarchy, glass confirmation action                   | compare selection/query 및 confirm contract                    |
| 확정 일정 조회 | `ItineraryPage`                                 | 날짜별 opaque list/timeline, state badge                                   | acknowledgement 및 unknown values                              |
| 확정 일정 편집 | `ItineraryEditPage`                             | form/list hierarchy, glass CTA/conflict accessory                          | rebase, expectedRevision, local draft                          |
| 공통 상태      | `PageState`, `RouteErrorFallback`, Sonner       | 16px text, live region, semantic status colors                             | loading/empty/error/success 분리                               |
| Overlay        | `Drawer`, `AlertDialog`, opinion/compare picker | overlay role token, opaque fallback, <=300ms/reduced motion                | Base UI focus trap/Escape/scroll lock/focus restore            |

Emotion feature 조정은 다음으로 제한한다.

- raw/legacy adaptive color를 semantic CSS variable로 교체
- 16px 본문/form typography와 line-height 교정
- content surface를 opaque token으로 교체
- 44px target과 overflow/wrapping 보정
- 공통 shell과 중복된 local header/footer style 제거

컴포넌트 구조나 state/data flow를 Tailwind 전용으로 다시 작성하지 않는다.

## 9. 상태와 오류 처리

| 입력 상태               | 표현                                           | 행동                                         |
| ----------------------- | ---------------------------------------------- | -------------------------------------------- |
| query pending           | loading text + 정적/회전 spinner               | primary data action 숨김 또는 disabled       |
| query success, 0 entity | empty state                                    | 가능한 시작 action만 제공                    |
| query error             | error alert                                    | retry 가능 시 retry 제공                     |
| mutation pending        | 동작형 label, `aria-busy`, disabled            | 같은 mutation 중복 제출 차단                 |
| mutation success        | 서버 resolve 후 success/toast/새 state         | query invalidate/navigation은 기존 계약 유지 |
| mutation error          | error state                                    | success를 표시하지 않고 입력 유지            |
| `REVISION_CONFLICT`     | conflict message + latest refetch/reapply 선택 | local edit를 보존하고 명시적 재시도          |
| domain state conflict   | 일반 revision recovery와 구분                  | 기존 API error meaning 유지                  |
| unknown price           | `가격 미정` 또는 `가격 미정 N건 별도`          | `0원`으로 대체하지 않음                      |
| unknown entity field    | `미정`/`확인 필요`처럼 명시                    | example/default entity 생성 금지             |

`PageState`나 UI token이 API error를 재분류하지 않는다. `Unauthorized`, `Forbidden`, validation, dependency failure, revision conflict는 기존 client error mapper와 feature branch를 그대로 사용한다.

## 10. 접근성 설계

- normal text/background token pair는 4.5:1 이상, large text는 3:1 이상을 만족한다.
- border, selected tab, focus ring, required icon 등 필수 non-text UI는 인접 색과 3:1 이상이다.
- 모든 interactive target은 44×44px 이상이다.
- keyboard order는 DOM 과업 순서를 따르며 CSS `order`로 의미 순서를 바꾸지 않는다.
- `:focus-visible` ring은 glass와 opaque 양쪽에서 식별 가능해야 한다.
- icon-only action은 기존 원칙대로 visible text 또는 `sr-only` 한글 text를 제공한다. 의미 없는 icon만 `aria-hidden`이다.
- overlay는 Base UI title/description, modal focus trap, Escape, focus restoration, background scroll lock을 유지한다.
- async state는 `role="status"`, `aria-live`, `role="alert"`, Sonner announcement 중 적절한 하나를 사용해 중복 읽기를 피한다.
- 200% zoom에서 핵심 정보와 action을 숨기지 않으며 line clamp가 과업 필수 정보를 잘라내면 상세 진입 또는 unclamped accessible text를 제공한다.

## 11. Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: 동적 Primary Action의 유일성과 권한 정합성

For any valid `TripRoom` and `RoomActor`, `resolvePlanHomeCta` SHALL return zero or one primary action, and every returned primary action and label SHALL correspond to the first action permitted by the existing domain eligibility resolver for that actor and room state.

**Validates: Requirements 1.4, 11.5**

### Property 2: Native Content Inset 정규화

For any measured native inset and fallback inset, `toContentTopInset` SHALL return the measured value exactly when it is finite and positive, and otherwise SHALL return the fallback; the companion shell contract SHALL consume that resolved value without adding Web safe-top.

**Validates: Requirements 5.4, 6.5**

### Property 3: 미정 가격의 보존

For any valid collection of accommodation and transport prices, every item without a price range SHALL increase `unpricedCount`, and a summary with no priced item SHALL be represented as `가격 미정` rather than `0원`; when priced and unpriced items coexist, the priced range and the number of pending items SHALL both remain visible.

**Validates: Requirements 9.10, 9.12**

### Property 4: Revision Conflict Three-Way Rebase

For any compatible base, local, and latest itinerary patch collections, each field changed locally from base SHALL preserve the local value after `rebaseItineraryPatches`, while each untouched field SHALL adopt the latest server value.

**Validates: Requirements 9.9, 9.11, 11.5**

### Property 5: View-Model Entity Provenance

For any valid Trip Room aggregate, the projected list view model SHALL preserve source entity cardinality, order, identity, and entered titles, and missing optional values SHALL be represented only by explicit pending/unknown text without creating a default entity or fabricated value.

**Validates: Requirements 4.1, 9.12, 11.5**

### 11.1 Property reflection 결과

- CTA의 uniqueness와 eligibility를 하나로 합쳐 label-only 중복 property를 제거했다.
- inset 값 정규화는 property로, DOM에서의 1회 적용은 platform integration test로 분리했다.
- 가격 합계 자체의 기존 calculation property는 이번 UI refresh와 중복되므로 미정 값 보존 property만 유지했다.
- rebase는 “local 변경 보존”과 “untouched latest 채택”을 하나의 property로 묶어 양방향 overwrite를 탐지한다.
- entity provenance는 price uncertainty와 다른 data boundary이므로 별도로 유지한다.

## 12. 테스트 및 검증 전략

### 12.1 Dual testing approach

**Property tests**는 위 다섯 pure contract만 대상으로 한다. 각 test는 최소 100개 생성 사례를 실행하고 실패를 재현할 수 있는 고정 seed/counterexample을 출력한다. 현재 runtime dependency는 추가하지 않으며 기존 Vitest 안에서 deterministic fixture generator를 사용한다. 필요 이상의 UI rendering PBT는 만들지 않는다.

각 test 이름 또는 주석은 다음 형식을 사용한다.

```text
Feature: toss-liquid-glass-ui-refresh, Property 1: 동적 Primary Action의 유일성과 권한 정합성
```

**Unit/component tests**는 구체적 상태와 edge case를 담당한다.

- `PageHeader`: sticky/bordered/glass role, Web safeTop, AIT topInset 배타성
- `BottomAction` + `PageBody`: CTA space와 accessory, fixed action contract
- `Tabs`: plans/itinerary의 visual active state와 `aria-selected`
- `Drawer`/`AlertDialog`: role/title, Escape, focus restoration, pending/error 유지
- `PageState`: loading/empty/error exclusive semantics와 live region
- form: permanent label, pending label, duplicate submit guard, failure input preservation
- accessory registration reject: reserved web share fallback
- unknown price: all unknown/mixed/zero-entered value를 구분
- long text: 긴 한글, URL, destination, title, author, amount edge case

### 12.2 Static contract tests

Vitest 또는 repository script로 다음을 검사한다.

- required semantic token과 `@theme inline` alias 존재
- `#root`의 stale `--adaptiveBackground` 제거
- backdrop filter가 허용된 chrome/overlay 파일 밖에 없음
- transition duration이 300ms를 넘지 않음
- `@apps-in-toss/*` import가 `src/platform/ait/**` 밖으로 나오지 않음
- feature/app에서 `@base-ui/react` 직접 import 없음
- TDS import/dependency 없음
- UI refresh용 신규 third-party runtime asset와 design-system runtime dependency 없음

### 12.3 Browser/visual verification matrix

현재 repository에는 전용 browser/visual 자동화 dependency가 없으므로 production runtime dependency를 추가하지 않는다. 기존 build를 사용해 실제 browser/AIT dev environment에서 다음 evidence를 수집한다.

| 축       | 값                                                         |
| -------- | ---------------------------------------------------------- |
| viewport | 320×568, 390×844, 1440×900                                 |
| platform | Web/PWA, AIT native navigation, AIT accessory failure      |
| backdrop | 지원, 미지원/강제 fallback                                 |
| motion   | no-preference, reduce                                      |
| zoom     | 100%, 200%                                                 |
| state    | loading, empty, error, success, mutation pending, conflict |

각 조합에서 다음을 확인한다.

- page horizontal scroll 없음
- desktop content width ≤720px 및 중앙 정렬
- safe area/native inset 중복 없음
- 마지막 content와 BottomAction 겹침 없음
- 44×44px target, 16px body/form, contrast 기준
- keyboard-only journey와 overlay focus lifecycle
- screen-reader name/role/state 및 async announcement
- glass/fallback의 동일 정보 위계
- local interaction visual response 시작 ≤100ms
- refresh가 유발한 CLS 합계 ≤0.1

CLS는 `layout-shift` PerformanceObserver에서 `hadRecentInput=false` entry를 합산하고 route별 cold/render/state transition을 각각 측정한다. local interaction은 event 시점부터 다음 paint의 pressed/selected/open state까지 Performance panel로 측정한다.

### 12.4 Repository gate

좁은 검증부터 실행한다.

```text
focused token/primitive test
→ affected feature component test
→ platform shell regression test
→ browser/visual matrix
→ pnpm check
```

`package.json`의 현재 canonical gate인 `pnpm check`는 lint, Vitest, Drizzle check/drift, web build, AIT build를 모두 포함한다.

## 13. 구현 순서와 rollout

1. **Foundation:** `src/index.css` role token, root background, motion/reduced-motion, content width를 추가하고 token static test를 작성한다.
2. **Primitive:** Button/Input/Textarea/Tabs/Drawer/AlertDialog/Spinner/Sonner를 접근성·motion·overlay token 계약에 맞춘다.
3. **Galanda shell:** PageHeader/BottomAction/PageBody/PageState/MobileList/PageTitle/SectionHeader를 갱신한다.
4. **Platform shell:** TripRoom layouts와 기존 ownership test를 확장한다. AIT adapter API는 바꾸지 않는다.
5. **Entry flows:** Login, Invite, TripList, TripCreate를 공통 shell에 맞춰 국소 조정한다.
6. **Plan flows:** PlanHome, editor, detail, compare를 목록/opaque content/glass chrome 규칙에 맞춘다.
7. **Itinerary flows:** 조회/편집, unknown value, conflict accessory를 같은 계약에 맞춘다.
8. **Verification:** 대표 viewport/platform/motion/backdrop/accessibility/CLS matrix와 `pnpm check`를 완료한다.

각 단계는 review 가능한 작은 diff로 유지하며, 공통 token 변경과 무관한 domain/refactor를 섞지 않는다.

## 14. 위험과 완화책

| 위험                                       | 영향                             | 완화                                                                                                            |
| ------------------------------------------ | -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 전역 token 변경으로 기존 Emotion 화면 회귀 | 여러 flow의 색/간격 동시 변화    | 기존 token alias 유지, 새 role token 추가 방식, 화면 matrix 검증                                                |
| glass 위 text 대비 저하                    | WCAG 실패, 정보 가독성 저하      | content는 opaque, chrome alpha를 보수적으로 설정, opaque fallback을 기본값으로 선언                             |
| blur 성능 저하                             | scroll/jank, local response 지연 | 적용 범위를 chrome/overlay로 제한, 작은 고정 영역만 blur, 100ms interaction 측정                                |
| BottomAction과 keyboard/content 겹침       | form 완료 불가                   | PageBody scroll padding, Drawer keyboardAware, safe-bottom owner 단일화                                         |
| AIT inset 이중 적용                        | 상단 과도한 공백/CLS             | `safeTop`과 `topInset` 배타 계약 및 generated inset+component regression test                                   |
| native accessory 실패 시 action 소실       | 공유 task dead end               | 기존 reserved web slot fallback 유지/테스트                                                                     |
| 44px target 확대로 layout overflow         | 320px 화면 가로 scroll           | glyph와 hit box 분리, action slot width 예약, 320px long-label test                                             |
| reduced motion에서 상태 의미 소실          | loading/state 인지 불가          | animation만 제거하고 text/live region 유지                                                                      |
| UI가 서버 상태를 앞서감                    | 허위 success/빈 상태             | query/mutation branch 유지, server resolve 전 success 금지, input/conflict regression                           |
| 전면 Tailwind migration으로 scope 확대     | review/회귀 비용 증가            | Emotion은 role token 치환과 필요한 spacing/typography만 수정                                                    |
| browser visual 자동화 부재                 | CLS/geometry 회귀 누락           | 명시적 browser evidence matrix를 completion gate로 두고 추후 별도 dev-tooling 결정 전 runtime dependency 미추가 |

## 15. Requirements Traceability

| Requirements | 설계 반영                                                                                         | 주요 검증                                                |
| ------------ | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1.1–1.5      | rollout matrix, 공통 composition, Primary Action resolver 보존                                    | Property 1, journey/component matrix                     |
| 2.1–2.6      | 역할 token model, `@theme inline`, Emotion var, root 정합성                                       | token/static tests, computed style                       |
| 3.1–3.7      | chrome-only progressive glass, opaque content, CTA clearance, mode tab                            | supports/fallback browser matrix, tab/component tests    |
| 4.1–4.7      | MobileList, heading hierarchy, 16px body/form, long-text policy                                   | Property 5, DOM outline/overflow tests                   |
| 5.1–5.7      | 720px content, representative viewport, safe area, keyboard/reflow                                | geometry/zoom/resize browser matrix                      |
| 6.1–6.8      | PlatformAdapter 유지, Web/AIT owner, inset 1회, accessory fallback, SDK 격리                      | Property 2, TripRoomTabLayout tests, import audit        |
| 7.1–7.12     | contrast, 44px target, focus, accessible names, overlay lifecycle, announcements                  | accessibility component/browser audit                    |
| 8.1–8.9      | ≤300ms token, reduced motion, opaque fallback, no runtime asset/dependency, CLS                   | static duration/import tests, performance matrix         |
| 9.1–9.12     | state/error table, duplicate guard, server-confirmed success, input/conflict/unknown preservation | Properties 3–5, state/mutation component tests           |
| 10.1–10.6    | Base UI Drawer/AlertDialog token화와 behavior 보존                                                | overlay role/focus/scroll/Escape/error tests             |
| 11.1–11.11   | directory boundaries, incremental Emotion, architecture invariants, verification order            | import/diff audit, platform/browser matrix, `pnpm check` |

## 16. 완료 조건

- Covered Flow 모두 rollout matrix에 따라 공통 token/shell을 사용한다.
- Content Surface는 opaque이고 glass는 Common Chrome/Overlay에만 있다.
- Web/PWA와 AIT의 navigation/inset/accessory owner가 중복되지 않는다.
- WCAG 2.2 AA, 44px target, keyboard/screen-reader, reduced motion, fallback, representative viewport, CLS ≤0.1 evidence가 있다.
- loading/empty/error/success/unknown/conflict 의미가 실제 server/system state와 일치한다.
- 신규 runtime 디자인 시스템 dependency, TDS, feature의 Base UI 직접 import, AIT SDK 경계 유출이 없다.
- focused tests와 `pnpm check`가 통과한다.
