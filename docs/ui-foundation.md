# Galanda UI Foundation (shadcn + Base UI + Tailwind)

RAON-181 이후 Galanda의 UI implementation layer 기준입니다. 화면 문법과 UX는
`docs/tds-ui-foundation.md`(RAON-160)의 정보 구조를 유지하되, 구현은 TDS가 아닌
`shadcn/ui + Base UI + Tailwind CSS`를 사용합니다.

## 스택 구성

- **shadcn/ui (Base UI backend)**: `src/components/ui/*` — CLI로 생성한 source-owned primitive.
  Base UI(`@base-ui/react`) 위에 구현되어 있고, 프로젝트가 소스를 소유합니다.
- **Galanda shell**: `src/components/galanda/*` — 제품 전용 얇은 composition
  (`PageHeader`, `BottomAction`, `PageState` 등). TDS API를 복제하지 않습니다.
- **Tailwind CSS v4**: `src/index.css`의 `@import "tailwindcss"` + semantic token.
- **Emotion**: 기존 feature 스타일은 당분간 유지합니다. 전면 제거는 비범위입니다.

## 공존 규칙

1. **신규 공통 UI primitive는 shadcn을 사용합니다.** Button/Input/Drawer/Tabs 같은
   일반 primitive를 직접 재구현하지 않습니다.
2. **앱 코드는 Base UI를 직접 import하지 않습니다.** 항상 `@/components/ui/*`를 경유합니다.
3. **기존 Emotion feature 스타일은 유지합니다.** 동작하는 화면을 이유 없이 Tailwind로
   재작성하지 않습니다.
4. **신규 feature-specific layout은 Tailwind 또는 Emotion 중 하나를 선택합니다.**
   한 컴포넌트 안에서 두 방식을 무분별하게 섞지 않습니다.
5. **TDS 신규 사용 금지.** `@toss/tds-mobile`, `@toss/tds-mobile-ait`는 더 이상
   import하지 않습니다.
6. **색상은 semantic token만 사용합니다.** `--background`, `--foreground`, `--muted`,
   `--muted-foreground`, `--primary`, `--border`, `--destructive`, `--success`,
   `--warning`, `--info` 등 (`src/index.css` 정의). `adaptiveGrey*`/`adaptiveBlue*`
   같은 TDS adaptive naming을 신규 코드에 확산하지 않습니다.
7. **플랫폼 API는 `src/platform/*` 경유.** `@apps-in-toss/*`는 Web/PWA UI 계층에서
   직접 import하지 않습니다 (RAON-188).
8. **아이콘으로 압축된 정보는 `sr-only` 한글 텍스트를 동반합니다.** 아이콘만으로 의미를
   전달하지 않습니다. `aria-label`로 덮어쓰는 대신 DOM 순서를 지키는 `sr-only` span을
   두어, 보이는 콘텐츠와 읽히는 콘텐츠가 1:1로 대응하게 합니다 (RAON-227).

## 토큰 요약

| 용도 | 토큰 |
| --- | --- |
| 화면/텍스트 기본 | `--background`, `--foreground` |
| 보조 텍스트/배경 | `--muted`, `--muted-foreground` |
| 브랜드/주요 행동 | `--primary`, `--primary-foreground` |
| 경계선/입력 | `--border`, `--input`, `--ring` |
| 위험/삭제 | `--destructive`, `--destructive-strong`, `--destructive-muted`, `--destructive-border` |
| 상태 배지 | `--success(-muted)`, `--warning(-muted/-border)`, `--info(-muted)` |
| 표면/텍스트 단계 | `--surface-subtle`, `--foreground-muted`, `--foreground-subtle` |
| 경계 단계 | `--border-strong`, `--border-stronger` |
| primary tint | `--primary-muted`, `--primary-border`, `--primary-border-weak` |
| 모서리 | `--radius` |

모든 토큰은 `@theme inline`에도 등록돼 있어 Tailwind utility(`text-foreground-subtle`,
`bg-surface-subtle` 등)로도 쓸 수 있어요.

**raw hex를 새로 도입하지 않습니다.** 필요한 색이 없으면 위 토큰에 역할 기반 이름으로
추가하고 사용합니다. (앱 로고 등 asset SVG는 예외예요.)

Safe-area와 화면 공통 여백은 `--safe-*`, `--app-*` 토큰을 계속 사용합니다.
상단 safe-area는 `PageHeader`가, 헤더가 없는 route는 `PageBody safeTop`이,
하단은 `BottomAction`과 `DrawerFooter`가 소유해요.

Trip Room의 Apps in Toss shell에서는 native navigation이 back/title/accessory를
소유하고, 웹은 그 아래 mode switcher만 렌더링합니다. 이때 `env(safe-area-inset-top)`을
중복 적용하지 않고 platform adapter가 제공하는 native content inset을 `PageHeader`에
한 번만 적용합니다. accessory 등록 실패는 예약된 우측 슬롯의 웹 공유 버튼으로
fallback하며 header owner를 바꾸지 않습니다.

## 컴포넌트 추가 방법

### 여행 중심 홈과 에셋

홈의 시각 기준은 `docs/assets/trip-led/home-reference.png`입니다. 여행 하나의 제목,
일정·인원, 현재 가능한 주요 행동을 우선합니다. 추천을 기다리거나 조회에 실패해도
여행방 진입을 유지하고, 이전에 조회한 정보를 보여주면 갱신 실패를 밝힙니다.
저장한 일정은 마이의 기존 저장 목록에서 제공합니다.
하단 단일 영역 피드백 이후에는 시안의 버튼 위치 대신 여행 정보 바로 뒤에 행동을
배치하며, 화면 하단으로 밀어내는 빈 공간을 만들지 않습니다.

- 일반 조작·메타데이터 아이콘은 기존 Lucide를 사용합니다. 홈에서는
  16/20/24px, 1.8px 선으로 맞추며 터치 영역은 Button/Link가 44px 이상 확보합니다.
- 글로벌 내비게이션은 아래의 전용 SVG 계약을 따릅니다. 일러스트나 Lucide 아이콘을
  하단 탭 아이콘과 혼용하지 않습니다.
- 일러스트는 `GalandaSpot`으로 렌더링합니다. 텍스트가 의미를 소유하고 그림은
  `aria-hidden` 및 빈 alt를 사용합니다. 실제 크기는 128px입니다.
- `create-trip`: 첫 여행안 시작 안내. `invite-companions`: 동행자 초대 안내.
- `compare-plans`: 미확정 일정에서 후보 확인 안내.
- `confirm-plan`: 서버에서 확정된 일정에만 사용하며 예약 완료를 뜻하지 않습니다.
- `empty-trips`, `empty-saved`: 해당 조회가 성공한 빈 상태에만 사용합니다.
- 모든 그림은 `public/assets/galanda/spots/`의 라이트·다크 SVG 쌍입니다.
  총 12개, 11,716 bytes이며 기존 PWA SVG precache 규칙으로 포함됩니다.
- `/dev#assets`에서 여섯 일러스트와 공통 아이콘을 검토할 수 있습니다.

로고·앱 아이콘·공유 이미지는 이 에셋 세트와 별개입니다. 서비스 코드에 일러스트
패키지 전체나 새 아이콘 의존성을 추가하지 않습니다.

### 글로벌 내비게이션 아이콘

`GlobalAppShell`은 `GlobalNavIcon`으로 홈·탐색·내 여행·마이 아이콘을 렌더링합니다.
기존 `resolveGlobalNavKey`의 같은 선택 상태로 `aria-current`와 아이콘 채움을
결정합니다. 선택된 항목은 filled, 나머지는 outline이며 `/me/saved`는 마이를 선택합니다.

- 승인된 SVG 원본 8개는 `public/assets/galanda/navigation/`에 보관합니다.
  `home`, `explore`, `trips`, `my` 각각 `-outline.svg`와 `-filled.svg` 쌍입니다.
- 렌더러는 원본과 같은 경로를 인라인 SVG로 사용합니다. 형상을 바꿀 때에는 원본과
  `src/components/galanda/global-nav-icon.tsx`를 함께 갱신합니다.
- `viewBox="0 0 24 24"`, 표시 크기 24px, 선 두께 2px, 둥근 끝·모서리를 유지합니다.
  선택 전환 시 외곽 크기를 바꾸지 않으며 그림자·그라데이션·원근감을 추가하지 않습니다.
- `currentColor`가 링크의 `text-primary` / `text-foreground-muted`를 상속합니다.
  흰색 도형으로 구멍을 덮지 않고 투명 영역과 `evenodd`로 테마 독립성을 유지합니다.
- 인라인 SVG이므로 탭 렌더링에 별도 이미지 요청이나 SVG 로더 패키지가 필요하지 않습니다.
  원본을 `<img>`로 교체하면 부모의 `color`를 상속하지 않으므로 사용하지 않습니다.
- 보이는 한글 링크 라벨이 접근 가능한 이름을 소유합니다. SVG는 `aria-hidden="true"`,
  `focusable="false"`로 두며 44px 이상 터치 영역, focus-visible, safe-area는 shell이 유지합니다.

### 여행 중심 주요 화면

모바일에서는 한 번에 하나의 판단과 주요 행동에 집중합니다. 정보를 삭제하거나
위험을 숨기는 대신, 제목 중심의 평평한 목록과 필요할 때 펼치는 상세 정보를 사용합니다.

- 하단 고정 영역은 한 종류만 사용합니다. 홈·탐색·내 여행·마이·저장 목록은 전역
  내비게이션만 고정하고, 실행 버튼은 본문 맥락 안에 둡니다. 생성·편집·확정 등의
  집중 작업은 기존처럼 전역 shell 밖에서 `BottomAction`을 사용합니다.
- 헤더·여행방 탭 영역·전역 내비게이션·하단 액션 영역의 장식용 경계선은 사용하지
  않습니다. 선택된 탭의 표시, 입력창·outline 버튼 테두리와 포커스 표시는 유지합니다.
- 내 여행은 진행 중/지난 여행을 분리하고, 여행명·일정·인원·진행 상태를 표시합니다.
  새 여행 만들기는 제목 옆 보조 행동으로 제공합니다. 진행 중인 여행이 없는 정상
  빈 상태에서는 본문 주요 행동으로 옮겨 중복 없이 한 곳에만 표시합니다.
- 여행방은 헤더와 계획/일정 탭을 상단에 함께 고정합니다. 본문 위에 떠 있는 하단 탭은
  사용하지 않습니다. Web/native 헤더 소유권과 native inset/accessory 계약은 유지합니다.
- 계획의 참여 상세 통계는 기본 HTML `details`로 펼칩니다. 예약 위험, 강한 반대 의견,
  집계할 수 없는 기존 의견 안내는 접지 않습니다. 후보의 비용·예약·응답 근거도 유지합니다.
- 계획의 추천 또는 대체 주요 행동은 하나의 `BottomAction`으로 모읍니다.
  후보가 없는 상태에서는 첫 여행안 안내의 행동과 중복하지 않습니다.
- 확정 일정은 선택한 날짜 하나를 표시합니다. 기존 `Tabs`로 날짜를 바꾸고 전체 경로는
  `details`로 펼칩니다. 갱신으로 선택한 날짜가 없어지면 첫 유효 날짜를 표시합니다.
  미확인 예약과 변경 확인 상태는 날짜 선택과 별개로 계속 안내합니다.
- 탐색은 검색어를 우선하고 테마·도시·날짜는 상세 필터에 둡니다. 접힌 상태에도 적용한
  필터 수를 표시하며 기존 URL 동기화·입력 검증·초기화 동작을 유지합니다.
- 공개/저장 일정과 마이는 불필요한 장식 카드와 가짜 이미지 영역 없이 실제 정보를
  보여줍니다. 저장 조작은 일정 링크 바깥에 유지합니다.

비교 화면의 두 후보는 하나의 비교 판단에 필요한 정보이므로 기존 비교 표를 유지합니다.
단일 질문형 생성 wizard, 권한·revision·오류 처리도 시각 단순화를 이유로 축소하지 않습니다.
검증 범위와 모바일 캡처는 저장소 루트 `design-qa.md`에서 확인합니다.

### Primitive 추가

```bash
npx shadcn@latest add <component>
```

`components.json`이 Base UI(`base-nova` style) 기준으로 설정되어 있어 생성물은
자동으로 Base UI 기반이 됩니다. 필요한 컴포넌트만 추가하고, 미리 전부 설치하지
않습니다.

## 화면 계약과 제품 패턴

단일 질문형 wizard 화면은 `WizardStepPage`를 사용합니다. 이 제품 패턴이
질문 본문과 하단 action 영역의 간격, progress, draft 상태, primary action과
선택적 secondary action을 함께 소유합니다.

FirstPlanWizard의 각 화면은 다음 경계를 지킵니다.

- `first-plan-wizard.contract.ts`: 질문별 ViewModel과 typed event
- `first-plan-wizard.presenter.ts`: 순수 ViewModel 계산
- `FirstPlanWizardView.tsx`: ViewModel 렌더링과 event dispatch만 담당
- `FirstPlanWizard.tsx`: 기존 editor/route 계약을 연결하는 controller

새 질문을 추가할 때는 View에서 hook, editor, query, storage를 직접 읽지 않고,
contract에 질문 상태와 event를 추가한 뒤 presenter와 View를 함께 갱신합니다.
footer를 직접 조립하거나 raw color를 추가하지 않습니다.

파일럿의 기본 조합은 다음과 같습니다.

```tsx
<WizardStepPage
  title={vm.header.title}
  description={vm.header.description}
  progress={vm.progress}
  draftStatus={vm.draftStatus}
  primaryAction={vm.actions.primary}
  secondaryAction={vm.actions.secondary}
  onAction={onEvent}
>
  <QuestionContent question={vm.question} onEvent={onEvent} />
</WizardStepPage>
```

ViewModel에는 snapshot 데이터만 둡니다. Presenter는 파생 상태를 저장하지 않고
React hook, DOM, query, storage, network를 참조하지 않습니다. View에서 DOM focus와
IME composition을 다루는 것은 허용하지만, 단순한 화면에 controller/presenter
layer를 의무적으로 늘리지 않습니다. draft 저장, offline, validation, publish는
서로 독립된 상태 축으로 유지합니다.

반복되는 panel과 선택 상태는 CVA recipe와 semantic token으로 표현합니다. 제품
패턴은 footer의 버튼 수·순서·variant·size·본문 여백을 소유하므로 feature가
`className`, `style`, `renderFooter` escape hatch로 우회하지 않습니다. 패턴을
확장해야 하면 새 상태/recipe를 추가하고 임의 CSS를 기본 해법으로 삼지 않습니다.

새 파일럿 화면은 contract → pure presenter test/typecheck fixture → View →
pattern/component test 순으로 추가하고,
`src/ui-foundation-contract.test.ts`의 scoped file 목록에 등록합니다. 전역
`--app-bottom-action-height`는 document root의 단일 footer 측정값이라는 제약이
있으므로 component test에서는 동시에 하나의 footer만 mount하고 accessory 높이
변화 후 본문 clearance 계약을 확인합니다. `BottomAction`은 padding/safe-area 변화도
측정하도록 border-box를 관찰합니다. `PageBody withBottomAction`의 실제 스크롤
여백에는 footer 높이와 keyboard inset을 포함하며, scroller의 scroll-padding만으로
본문 끝의 스크롤 공간을 대신하지 않습니다.

계약 guard는 다음 명령으로 실행합니다.

```bash
pnpm exec vitest run src/ui-foundation-contract.test.ts
```
