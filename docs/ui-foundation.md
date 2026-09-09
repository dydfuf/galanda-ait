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

### 공통 아이콘 카탈로그와 생성

제품 UI에서는 `GalandaIcon`과 개발 전용 `/dev/icons` 카탈로그를 우선 사용합니다.
기본 세트는 80종 / SVG 85개이며 검색·편집·상태·교통·지출·협업·설정을 포함합니다.
사용 예제, 상태 의미, 추가 절차는 [아이콘 시스템](icon-system.md)에 정리합니다.

SVG 원본과 `icons/labels.json`이 source of truth입니다. 변경 후
`node scripts/generate-icons.mjs`로 `icons/icon-nodes.ts`와 `icons/catalog.ts`를
생성하고 함께 커밋합니다. `node scripts/generate-icons.mjs --check`와 기존 Vitest
검사가 원본/생성물 차이를 잡습니다. 생성 파일을 수작업으로 수정하지 않습니다.
`PlanningIcon`, `ActionIcon`, `DecisionIcon`은 기존 API/data-slot을 유지하는
`GalandaIcon` wrapper이며, 기능 상태나 이벤트 처리를 옮기지 않습니다.
`GlobalNavIcon`은 기존 선택 계약을 유지합니다. 카탈로그는 production route에 등록하지 않습니다.

### 여행 중심 홈과 에셋

홈의 시각 기준은 `docs/assets/trip-led/home-reference.png`입니다. 여행 하나의 제목,
일정·인원, 현재 가능한 주요 행동을 우선합니다. 추천을 기다리거나 조회에 실패해도
여행방 진입을 유지하고, 이전에 조회한 정보를 보여주면 갱신 실패를 밝힙니다.
저장한 일정은 마이의 기존 저장 목록에서 제공합니다.
하단 단일 영역 피드백 이후에는 시안의 버튼 위치 대신 여행 정보 바로 뒤에 행동을
배치하며, 화면 하단으로 밀어내는 빈 공간을 만들지 않습니다.

- 신규 제품 아이콘은 `GalandaIcon`의 16/20/24px, 2px 선 규격을 따릅니다.
  터치 영역은 Button/Link가 44px 이상 확보합니다. 기존 미전환 Lucide와 shadcn
  primitive 내부 아이콘은 유지하며, 라이브러리 제거를 위한 전면 재작성은 하지 않습니다.
- 글로벌 내비게이션은 아래의 전용 SVG 계약을 따릅니다. 일러스트나 Lucide 아이콘을
  하단 탭 아이콘과 혼용하지 않습니다.
- 일러스트는 `GalandaSpot`으로 렌더링합니다. 텍스트가 의미를 소유하고 그림은
  `aria-hidden` 및 빈 alt를 사용합니다. 실제 크기는 128px입니다.
- `create-trip`: 첫 여행안 시작 안내. `invite-companions`: 동행자 초대 안내.
- `compare-plans`: 미확정 일정에서 후보 확인 안내.
- `confirm-plan`: 서버에서 확정된 일정에만 사용하며 예약 완료를 뜻하지 않습니다.
- `empty-trips`, `empty-saved`: 해당 조회가 성공한 빈 상태에만 사용합니다.
- 모든 그림은 `public/assets/galanda/spots/`의 라이트·다크 SVG 쌍입니다.
  총 12개이며 기존 PWA SVG precache 규칙으로 포함됩니다.
  홈·빈 상태와 협업·확정의 6종 모두 원본에서 다크 팔레트를 조정한 입체형 SVG입니다.
  추가 밝기 필터나 이름별 대비 보정 예외를 적용하지 않습니다.
  원본 240×240, 표시 128×128, 테마별 도형 일치 및 파일당 4KB 미만 기준은
  [일러스트 가이드](../public/assets/galanda/spots/README.md)를 따릅니다.
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
  `src/components/galanda/global-nav-icon.tsx`를 함께 갱신하고 공통 생성기도 실행합니다.
- `viewBox="0 0 24 24"`, 표시 크기 24px, 선 두께 2px, 둥근 끝·모서리 유지합니다.
  선택 전환 시 외곽 크기를 바꾸지 않으며 그림자·그라데이션·원근감을 추가하지 않습니다.
- `currentColor`가 링크의 `text-primary` / `text-foreground-muted`를 상속합니다.
  흰색 도형으로 구멍을 덮지 않고 투명 영역과 `evenodd`로 테마 독립성을 유지합니다.
- 인라인 SVG이므로 탭 렌더링에 별도 이미지 요청이나 SVG 로더 패키지가 필요하지 않습니다.
  원본을 `<img>`로 교체하면 부모의 `color`를 상속하지 않으므로 사용하지 않습니다.
- 보이는 한글 링크 라벨이 접근 가능한 이름을 소유합니다. SVG는 `aria-hidden="true"`,
  `focusable="false"`로 두며 44px 이상 터치 영역, focus-visible, safe-area는 shell이 유지합니다.

### 여행 준비 아이콘

`PlanningIcon`은 일정·경로·숙소·예약 항목을 나타내는 outline 전용 아이콘입니다.
하단 탭의 선택 상태나 예약 완료 배지를 대신하지 않습니다.

- 원본은 `public/assets/galanda/planning/`의 `calendar`, `route`, `stay`, `ticket`
  각각 `-outline.svg`입니다. 원본 4개를 보존하고 생성된 노드로 인라인 렌더링합니다.
- 원본 변경 후 공통 생성기를 실행합니다. `planning-icon.tsx`에 형상을 복사하지 않습니다.
  `planning-icon.test.tsx`는 원본 파일과 실제 렌더러의 형상·색상 속성 일치를 검사합니다.
- 24×24 viewBox, 2px 선, 둥근 끝·모서리, `fill="none"`, `stroke="currentColor"`를
  유지합니다. 기본 24px, 목록 20px, 기존 홈 메타데이터 정렬에는 16px를 사용합니다.
- 색상을 하드코딩하거나 흰색으로 빈 부분을 덮지 않습니다. 기존 semantic token을
  상속하므로 라이트·다크 파일 교체, 이미지 요청, 별도 SVG 로더가 필요하지 않습니다.
- 의미는 기존 한글 텍스트가 소유하며 SVG는 `aria-hidden="true"`, `focusable="false"`입니다.
  크기 속성은 그림의 크기이며 링크·버튼의 터치 영역을 대신하지 않습니다.
- 홈의 여행 날짜에 `calendar`, 숙소·교통 상세 타임라인의 항목 표시에 `stay`/`route`,
  예약·교통 정보 링크에 `ticket`을 적용합니다. 숙소/이동 라벨과 예약 가능·만실·확인 필요·
  아직 확인 전 배지, 링크가 없는 상태와 외부 URL 열기 동작은 유지합니다.
- 전역 내비게이션, 일반 조작용 Lucide, 일러스트, PWA 로고는 이 세트와 분리합니다.

### 시작·협업·완료 아이콘

`ActionIcon`은 `create-trip`, `companions`, `invite`, `complete`를 제공합니다.
기존 `PlanningIcon`과 같은 outline 규격이며 전역 탭 선택 상태와는 별개입니다.

- 원본은 `public/assets/galanda/actions/*-outline.svg`에 보관합니다.
  변경 후 공통 생성기를 실행하며 `action-icon.test.tsx`가
  원본과 실제 렌더러의 형상·색상 속성 차이를 검사합니다.
- 24×24 viewBox, 2px 선, 둥근 끝·모서리, `fill="none"`, `stroke="currentColor"`를
  유지합니다. 기본 24px, 행동/상태 20px, 홈 참여 인원에는 16px를 사용합니다.
- 색상은 기존 semantic token을 상속합니다. 생성 버튼에서는 버튼 글자색을 따르고,
  동행은 `text-muted-foreground`, 초대는 `text-primary`, 완료는 `text-success`입니다.
  라이트·다크 파일 교체, 흰색 배경 도형, 별도 이미지 요청이나 로더는 사용하지 않습니다.
- 홈의 빈 상태·지난 여행 상태에서 새 여행 만들기 링크에 `create-trip`, 홈 여행 카드의
  실제 참여 인원에 `companions`, 동행자 설정의 초대 링크 공유 영역에 `invite`를 사용합니다.
  기존 링크 목적지와 초대 권한·공유/복사/취소/실패·pending 동작은 변경하지 않습니다.
- `PlanEditorHeader`는 `draftSaveStatus === "SAVED"`일 때만 `complete`를 표시합니다.
  기존 `자동 저장됨` 텍스트를 유지하며, 이는 로컬 임시 저장 성공이지 서버 공개·여행 확정·
  예약 완료가 아닙니다. `IDLE`/`SAVING`/`ERROR`에는 완료 체크를 표시하지 않습니다.
- 보이는 한글 텍스트가 의미를 소유합니다. SVG는 `aria-hidden="true"`, `focusable="false"`이며,
  아이콘 크기를 링크·버튼의 터치 영역으로 취급하지 않습니다. 기존 일러스트는 유지합니다.

### 비교·보관·가져오기·공유 아이콘

`DecisionIcon`은 `compare`, `bookmark`, `import-plan`, `share`를 제공합니다.
원본 5개는 `public/assets/galanda/decision/`에 보관하며 생성된 노드로 인라인 렌더링합니다.

- `bookmark`만 `variant="outline" | "filled"`를 지원합니다. 같은 경로에 채움만
  전환하며 나머지 아이콘은 outline 전용입니다. `decision-icon.test.tsx`가 원본과
  실제 React 렌더러의 형상·색상 계약을 비교합니다.
- 24×24 viewBox, 2px 선, 둥근 끝·모서리, `currentColor`, 투명 배경을 유지합니다.
  기본 24px, 행동 버튼 20px, 작은 추천 보조 버튼 16px이며 부모의 semantic color를
  상속합니다. 라이트·다크 전용 파일, 고정 색상, SVG 로더를 추가하지 않습니다.
- `PlanHomePage`의 비교 CTA·비교 대상 선택 Drawer와 `NextActionRecommendation`의
  `COMPARE_PLANS` 행동에 `compare`를 표시합니다. 확정·의견·생성 행동에는 붙이지
  않으며 기존 후보 수·권한·선택 개수·추천 노출 조건과 이동 동작을 유지합니다.
- `ExploreSaveToggle`은 기존 `saved` 값으로 북마크 채움을 결정합니다. 보관 여부이지
  임시 저장·예약 완료가 아닙니다. mutation 중에는 기존 Spinner를 표시하고 실패 시
  기존 query rollback에 따라 형상도 복구합니다. `aria-pressed`, 저장/저장됨 라벨,
  세션·초기 로딩·오프라인·disabled 조건을 변경하지 않습니다.
- `ExploreImportAction`의 가져오기 버튼과 `TripRoomTabLayout`의 웹 공유 버튼에
  적용합니다. 가져오기 Drawer, 공유 처리, 네이티브 accessory와 웹 fallback 조건은
  그대로 유지합니다. 네이티브 `icon-share-mono`는 이 웹 SVG로 대체하지 않습니다.
- 기존 버튼/링크가 접근 가능한 이름과 터치 영역을 소유합니다. SVG는
  `aria-hidden="true"`, `focusable="false"`이며 별도 포커스 대상을 만들지 않습니다.
- 이전 내비게이션·여행 준비·시작/협업 아이콘과 일러스트·PWA 로고는 변경하지 않습니다.

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