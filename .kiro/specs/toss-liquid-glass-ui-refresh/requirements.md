# Requirements Document

## Introduction

이 문서는 Galanda의 주요 사용자 여정 전반에 일관된 시각 품질, 명확한 정보 구조, 접근 가능한 상호작용을 제공하기 위한 UI/UX 개선 요구사항을 정의한다.

## Glossary

- **Galanda_UI**: Galanda 사용자가 화면에서 보고 조작하는 전체 사용자 인터페이스.
- **Toss_Visual_Language**: 흰색 중심의 명확한 표면, 강한 정보 위계, 목록 중심 구성, 읽기 쉬운 타이포그래피, 분명한 주요 행동을 사용하는 시각 문법.
- **Liquid_Glass**: 반투명 표면, 배경 흐림, 경계, 고도감을 절제해 떠 있는 영역을 배경과 구분하는 시각 문법.
- **UI_Refresh**: Toss_Visual_Language를 기본으로 유지하고 Liquid_Glass를 선택적으로 결합하는 이번 개선 범위.
- **Covered_Flow**: 로그인, 초대, 여행 목록, 여행 생성, 여행방 shell, 여행안 목록, 여행안 작성, 여행안 상세, 여행안 편집, 여행안 비교, 확정 일정 조회, 확정 일정 편집, 공통 로딩 상태, 공통 빈 상태, 공통 오류 상태, overlay를 포함하는 주요 사용자 여정.
- **Content_Surface**: 제목, 설명, 목록, 폼, 일정, 가격, 상태 등 핵심 정보를 담는 불투명한 본문 표면.
- **Common_Chrome**: 본문 위에 고정되거나 떠 있으면서 내비게이션 또는 행동을 제공하는 공통 UI 영역.
- **Page_Header**: 뒤로 가기, 화면 제목, 상단 행동을 제공하는 Common_Chrome.
- **Bottom_Action**: 화면 하단에 고정되어 현재 단계의 주요 행동을 제공하는 Common_Chrome.
- **Mode_Tab**: 여행방에서 계획과 일정 사이를 전환하는 Common_Chrome.
- **Overlay**: 현재 화면 위에 drawer 또는 dialog 형태로 열리는 일시적 상호작용 영역.
- **Semantic_Token**: 색상 값이나 효과 값을 직접 표현하지 않고 배경, 표면, 경계, 고도, 흐림, 움직임처럼 역할로 이름 붙인 디자인 값.
- **UI_Foundation**: `docs/ui-foundation.md`가 정의하는 shadcn, Base UI, Tailwind CSS, Galanda 공통 composition의 현재 구현 계약.
- **Primary_Action**: 현재 화면 또는 현재 단계에서 사용자의 다음 핵심 과업을 진행하는 가장 높은 우선순위의 행동.
- **System_State**: 서버 응답, 사용자 입력, 요청 진행 여부, 오류, 권한, 동시성 결과로 확정되는 실제 애플리케이션 상태.
- **Revision_Conflict**: 오래된 revision을 기준으로 저장을 시도해 서버가 반환하는 동시성 충돌 상태.
- **Web_PWA**: 일반 웹 브라우저와 설치형 Progressive Web App에서 실행되는 Galanda 대상.
- **Apps_in_Toss**: 토스 앱 WebView 안에서 native 기능과 함께 실행되는 Galanda 대상.
- **Platform_Adapter**: Web_PWA와 Apps_in_Toss의 플랫폼 기능 차이를 일반 기능 UI에서 분리하는 기존 추상화.
- **Platform_Integration**: Platform_Adapter를 통해 플랫폼별 내비게이션, inset, accessory를 연결하는 UI 경계.
- **Native_Navigation**: Apps_in_Toss가 소유하는 뒤로 가기, 제목, accessory 영역.
- **Content_Inset**: Native_Navigation 아래에서 웹 콘텐츠가 시작해야 하는 상단 여백 값.
- **Safe_Area**: 기기 notch, 상태 표시줄, 홈 indicator와 콘텐츠가 겹치지 않도록 예약하는 영역.
- **Representative_Viewport**: 320×568 CSS px 모바일, 390×844 CSS px 모바일, 1440×900 CSS px 데스크톱 viewport.
- **WCAG_2_2_AA**: Web Content Accessibility Guidelines 2.2의 Level AA 적합 기준.
- **Normal_Text**: 24 CSS px 미만이면서 19 CSS px 이상의 굵은 글자 조건에도 해당하지 않는 텍스트.
- **Large_Text**: 24 CSS px 이상이거나 19 CSS px 이상의 굵은 텍스트.
- **Non_Text_UI**: 입력 경계, 선택 상태, 아이콘, focus indicator처럼 텍스트가 아닌 필수 시각 정보.
- **Keyboard_User**: 키보드만 사용해 Galanda_UI를 탐색하고 조작하는 사용자.
- **Screen_Reader**: DOM의 이름, 역할, 상태, 관계를 음성 또는 점자로 전달하는 보조 기술.
- **Touch_Target**: 터치 또는 포인터 입력으로 행동을 실행하는 조작 가능 영역.
- **Reduced_Motion_Mode**: 운영체제 또는 브라우저의 `prefers-reduced-motion: reduce` 설정이 활성화된 상태.
- **Backdrop_Filter**: 표면 뒤의 콘텐츠에 흐림 효과를 적용하는 브라우저 기능.
- **Opaque_Fallback**: Backdrop_Filter 없이도 본문 가독성과 표면 구분을 유지하는 불투명 대체 표현.
- **Local_Interaction**: 네트워크 완료를 기다리지 않는 탭 선택, 버튼 press 상태, drawer 열기, dialog 열기, focus 이동.
- **Visual_Stability_Score**: UI_Refresh가 유발한 Cumulative Layout Shift 측정값.
- **UI_Implementation**: Galanda_UI를 구성하는 공통 primitive, 제품 composition, feature UI, 스타일, 플랫폼 연결 코드.
- **Verification_Process**: 자동 테스트와 대표 화면 검토를 통해 acceptance criteria 충족 여부를 확인하는 절차.
- **Canonical_Gate**: 저장소의 `package.json`이 정의하는 `pnpm check` 검증 명령.

## Goals

- Covered_Flow 전체에서 Toss_Visual_Language에 기반한 일관된 정보 구조와 상호작용을 제공한다.
- Liquid_Glass를 Common_Chrome과 Overlay에 집중해 절제된 깊이감을 제공한다.
- Content_Surface의 가독성과 목록 중심 탐색을 유지한다.
- Web_PWA와 Apps_in_Toss에서 동등한 시각 품질과 상태 표현을 제공한다.
- 접근성, 반응형, 움직임, 브라우저 fallback을 검증 가능한 품질 기준으로 만든다.

## Non-Goals

- 도메인 규칙, 서버 API, 인증, 권한, persistence, concurrency 계약을 변경하지 않는다.
- 기존 정보 구조나 Covered_Flow의 과업 순서를 재설계하지 않는다.
- 기존 Emotion 기반 feature 화면을 전면 Tailwind CSS로 마이그레이션하지 않는다.
- TDS를 UI_Implementation 또는 일반 feature UI에 다시 도입하지 않는다.
- Apps_in_Toss의 Native_Navigation 소유권을 웹 UI로 이전하지 않는다.
- 예시 데이터, 임의 기본 entity, 허위 성공 상태를 추가하지 않는다.

## Requirements

### Requirement 1: 전체 여정과 경험 일관성

**User Story:** Galanda 사용자로서, 주요 사용자 여정이 하나의 제품처럼 일관되기를 원한다. 그래야 화면마다 새로운 조작 방식을 학습하지 않고 여행 계획에 집중할 수 있다.

#### Acceptance Criteria

1.1 THE Galanda_UI SHALL 모든 Covered_Flow에 UI_Refresh를 적용한다.

1.2 WHEN 사용자가 Covered_Flow 사이를 이동할 때, THE Galanda_UI SHALL 같은 기능을 같은 시각적 역할로 표현한다.

1.3 THE Galanda_UI SHALL 기존 Covered_Flow의 정보 구조와 과업 순서를 유지한다.

1.4 THE Galanda_UI SHALL 각 과업 단계에서 Primary_Action을 보조 행동보다 높은 시각적 우선순위로 표현한다.

1.5 WHEN 사용자가 Primary_Action을 완료할 수 없는 상태에 도달할 때, THE Galanda_UI SHALL 완료 조건을 Primary_Action과 같은 화면에 표시한다.

### Requirement 2: 역할 기반 시각 체계

**User Story:** Galanda 사용자로서, 색상과 표면이 일관된 의미를 전달하기를 원한다. 그래야 화면의 구조와 상태를 빠르게 이해할 수 있다.

#### Acceptance Criteria

2.1 THE UI_Implementation SHALL 배경, Content_Surface, Common_Chrome, 경계, 고도, 흐림, 움직임을 Semantic_Token으로 표현한다.

2.2 THE UI_Implementation SHALL 비자산 UI 색상을 Semantic_Token에서 가져온다.

2.3 THE UI_Implementation SHALL Semantic_Token을 Tailwind CSS와 기존 Emotion feature 스타일에서 같은 역할로 사용할 수 있게 제공한다.

2.4 THE Galanda_UI SHALL 최상위 화면 배경을 배경 역할의 Semantic_Token으로 표현한다.

2.5 WHEN 같은 System_State가 서로 다른 Covered_Flow에 표시될 때, THE Galanda_UI SHALL 같은 상태 역할의 Semantic_Token을 사용한다.

2.6 THE UI_Implementation SHALL 표면, 경계, 고도, 흐림, 움직임 값을 역할별로 독립 조정할 수 있게 정의한다.

### Requirement 3: 절제된 Liquid Glass와 Common Chrome

**User Story:** Galanda 사용자로서, 떠 있는 내비게이션과 행동 영역이 본문과 명확히 구분되기를 원한다. 그래야 현재 위치와 다음 행동을 놓치지 않을 수 있다.

#### Acceptance Criteria

3.1 WHERE Backdrop_Filter를 지원하는 환경에서, THE Galanda_UI SHALL Common_Chrome과 Overlay에 Liquid_Glass를 적용한다.

3.2 THE Galanda_UI SHALL Content_Surface를 불투명한 Toss_Visual_Language 표면으로 표시한다.

3.3 THE UI_Implementation SHALL Backdrop_Filter 적용 영역을 Common_Chrome과 Overlay로 제한한다.

3.4 WHEN Page_Header가 고정 상태로 본문 위에 놓일 때, THE Galanda_UI SHALL Page_Header의 경계를 배경과 식별 가능하게 표시한다.

3.5 WHEN Bottom_Action이 표시될 때, THE Galanda_UI SHALL 마지막 본문 항목이 Bottom_Action 위까지 스크롤되도록 공간을 제공한다.

3.6 WHEN Mode_Tab의 선택 값이 변경될 때, THE Galanda_UI SHALL 선택된 Mode_Tab을 시각 상태와 접근성 상태로 표시한다.

3.7 THE Galanda_UI SHALL Common_Chrome의 Liquid_Glass보다 Content_Surface의 텍스트와 과업 정보를 높은 가독성 우선순위로 표시한다.

### Requirement 4: 본문 표면, 정보 위계, 타이포그래피

**User Story:** Galanda 사용자로서, 여행 정보가 읽기 쉬운 순서와 밀도로 제시되기를 원한다. 그래야 목록을 훑고 세부 정보를 비교할 수 있다.

#### Acceptance Criteria

4.1 WHEN Covered_Flow가 복수 entity를 제공할 때, THE Galanda_UI SHALL entity를 목록 중심 구조로 표시한다.

4.2 THE Galanda_UI SHALL 화면 제목, section 제목, 본문, 보조 정보의 시각적 위계를 구분한다.

4.3 THE Galanda_UI SHALL 본문 텍스트와 form control 텍스트를 16 CSS px 이상으로 표시한다.

4.4 WHEN 정보 문자열이 사용 가능한 너비를 초과할 때, THE Galanda_UI SHALL 과업 완료에 필요한 내용을 읽을 수 있도록 줄바꿈 또는 상세 접근을 제공한다.

4.5 WHEN form field가 표시될 때, THE Galanda_UI SHALL placeholder와 독립된 영구 label을 제공한다.

4.6 WHEN 화면에 heading이 둘 이상 존재할 때, THE Galanda_UI SHALL heading level을 DOM 순서에 맞게 구성한다.

4.7 THE Galanda_UI SHALL 장식 효과보다 제목, 상태, 값, 행동 순서로 시선 흐름을 구성한다.

### Requirement 5: 반응형, Safe Area, 콘텐츠 가시성

**User Story:** Galanda 사용자로서, 모바일과 데스크톱에서 내용과 행동이 화면에 맞게 배치되기를 원한다. 그래야 사용하는 기기에 관계없이 같은 과업을 완료할 수 있다.

#### Acceptance Criteria

5.1 WHILE Galanda_UI가 Representative_Viewport에서 표시되는 동안, THE Galanda_UI SHALL 페이지 단위 가로 스크롤 없이 핵심 콘텐츠와 행동을 viewport 안에 배치한다.

5.2 WHEN 데스크톱 Representative_Viewport가 사용될 때, THE Galanda_UI SHALL 주요 콘텐츠 열을 720 CSS px 이하의 너비로 화면 중앙에 배치한다.

5.3 WHEN 모바일 Representative_Viewport에 Bottom_Action이 표시될 때, THE Galanda_UI SHALL Bottom_Action을 viewport 하단에 고정한다.

5.4 WHEN Safe_Area 값이 0보다 클 때, THE Galanda_UI SHALL Page_Header와 Bottom_Action 콘텐츠를 Safe_Area 밖에 배치한다.

5.5 WHEN 가상 키보드가 열린 상태에서 form field를 편집할 때, THE Galanda_UI SHALL focus된 field와 해당 단계의 Primary_Action에 스크롤로 접근할 수 있게 유지한다.

5.6 WHEN 사용자가 텍스트를 200%로 확대할 때, THE Galanda_UI SHALL 정보 또는 기능 손실 없이 Covered_Flow를 제공한다.

5.7 WHEN viewport 크기가 변경될 때, THE Galanda_UI SHALL System_State와 사용자 입력을 유지한 채 layout을 재배치한다.

### Requirement 6: Web/PWA와 Apps in Toss 플랫폼 계약

**User Story:** Galanda 사용자로서, Web/PWA와 Apps in Toss에서 같은 제품 품질을 경험하기를 원한다. 그래야 실행 환경이 달라도 여행 계획 방식이 달라지지 않는다.

#### Acceptance Criteria

6.1 THE Galanda_UI SHALL Web_PWA와 Apps_in_Toss에서 같은 Semantic_Token 역할을 사용한다.

6.2 THE Galanda_UI SHALL Web_PWA와 Apps_in_Toss에서 같은 System_State 의미를 표시한다.

6.3 WHERE Web_PWA가 활성화된 경우, THE Platform_Integration SHALL 웹 Page_Header에 뒤로 가기, 제목, 상단 행동을 제공한다.

6.4 WHERE Apps_in_Toss가 활성화된 경우, THE Platform_Integration SHALL Native_Navigation에 뒤로 가기, 제목, accessory 소유권을 부여한다.

6.5 WHERE Apps_in_Toss가 활성화된 경우, WHILE Native_Navigation이 표시되는 동안, THE Platform_Integration SHALL Content_Inset을 웹 콘텐츠 상단에 한 번 적용한다.

6.6 WHERE Apps_in_Toss가 활성화된 경우, IF native accessory 등록이 실패하면, THE Platform_Integration SHALL 예약된 우측 슬롯에 웹 공유 행동을 표시한다.

6.7 WHERE Apps_in_Toss가 활성화된 경우, THE Platform_Integration SHALL Mode_Tab을 Native_Navigation 아래의 웹 콘텐츠로 표시한다.

6.8 THE UI_Implementation SHALL Apps in Toss SDK 접근을 `src/platform/ait` 경계 안에 유지한다.

### Requirement 7: 접근성

**User Story:** 보조 기술 또는 키보드를 사용하는 Galanda 사용자로서, 모든 주요 여정을 독립적으로 완료하기를 원한다. 그래야 입력 방식이나 시각 조건에 관계없이 여행에 참여할 수 있다.

#### Acceptance Criteria

7.1 THE Galanda_UI SHALL Normal_Text와 배경 사이에 4.5:1 이상의 명도 대비를 제공한다.

7.2 THE Galanda_UI SHALL Large_Text와 배경 사이에 3:1 이상의 명도 대비를 제공한다.

7.3 THE Galanda_UI SHALL 필수 Non_Text_UI와 인접 색상 사이에 3:1 이상의 명도 대비를 제공한다.

7.4 THE Galanda_UI SHALL 각 Touch_Target에 최소 44×44 CSS px의 조작 영역을 제공한다.

7.5 WHEN Keyboard_User가 Tab 또는 Shift+Tab을 누를 때, THE Galanda_UI SHALL 조작 가능한 요소를 DOM 순서에 따라 이동한다.

7.6 WHILE 조작 가능한 요소가 keyboard focus를 가진 동안, THE Galanda_UI SHALL 배경과 식별 가능한 focus indicator를 표시한다.

7.7 WHEN Screen_Reader가 조작 가능한 요소를 탐색할 때, THE Galanda_UI SHALL 요소의 접근 가능한 이름, 역할, 상태를 제공한다.

7.8 WHEN 아이콘이 정보 또는 행동 의미를 전달할 때, THE Galanda_UI SHALL 아이콘과 대응하는 screen-reader 텍스트를 제공한다.

7.9 WHILE modal Overlay가 열려 있는 동안, THE Galanda_UI SHALL keyboard focus를 modal Overlay 내부에 유지한다.

7.10 WHEN modal Overlay가 닫힐 때, THE Galanda_UI SHALL keyboard focus를 Overlay를 연 요소로 복원한다.

7.11 WHEN 로딩, 오류, 저장 결과가 변경될 때, THE Galanda_UI SHALL Screen_Reader에 상태 변경을 알린다.

7.12 THE Verification_Process SHALL Covered_Flow의 UI_Refresh가 WCAG_2_2_AA 기준을 충족하는지 검증한다.

### Requirement 8: 움직임, fallback, 성능

**User Story:** Galanda 사용자로서, 시각 효과가 기기 기능이나 움직임 선호와 관계없이 안정적으로 동작하기를 원한다. 그래야 장식 효과 때문에 과업 수행이 방해받지 않는다.

#### Acceptance Criteria

8.1 THE Galanda_UI SHALL 상태 전환과 Overlay 전환의 기본 지속 시간을 300ms 이하로 제한한다.

8.2 WHILE Reduced_Motion_Mode가 활성화된 동안, THE Galanda_UI SHALL 비필수 이동과 확대·축소 효과를 즉시 상태 변경으로 대체한다.

8.3 WHILE Reduced_Motion_Mode가 활성화된 동안, THE Galanda_UI SHALL 로딩과 System_State 변화를 텍스트 또는 정적 시각 상태로 전달한다.

8.4 IF Backdrop_Filter를 지원하지 않는 환경이면, THEN THE Galanda_UI SHALL Liquid_Glass 영역에 Opaque_Fallback을 표시한다.

8.5 WHILE Opaque_Fallback이 표시되는 동안, THE Galanda_UI SHALL Liquid_Glass 환경과 동일한 정보 위계와 명도 대비 기준을 유지한다.

8.6 WHEN Local_Interaction이 발생할 때, THE Galanda_UI SHALL 100ms 이내에 시각적 반응을 시작한다.

8.7 THE UI_Implementation SHALL UI_Refresh를 위한 신규 third-party runtime asset 요청 없이 시각 자산을 제공한다.

8.8 THE UI_Implementation SHALL UI_Refresh를 위한 신규 design-system runtime dependency 없이 UI_Foundation을 사용한다.

8.9 THE Verification_Process SHALL 각 Representative_Viewport에서 0.1 이하의 Visual_Stability_Score를 확인한다.

### Requirement 9: 실제 시스템 상태 표현

**User Story:** Galanda 사용자로서, 화면이 실제 저장 및 조회 상태를 정확히 보여주기를 원한다. 그래야 잘못 저장되었다고 믿거나 존재하지 않는 정보를 기준으로 결정하지 않는다.

#### Acceptance Criteria

9.1 WHEN 데이터 요청이 진행 중일 때, THE Galanda_UI SHALL 로딩 System_State를 표시한다.

9.2 WHEN 서버 응답이 조회 결과 0건을 확정할 때, THE Galanda_UI SHALL 빈 System_State를 표시한다.

9.3 IF 데이터 요청이 실패하면, THEN THE Galanda_UI SHALL 오류 System_State를 성공 또는 빈 System_State와 구분해 표시한다.

9.4 WHERE 실패한 요청을 다시 실행할 수 있는 경우, THE Galanda_UI SHALL 오류 System_State에 재시도 행동을 제공한다.

9.5 WHEN mutation 요청이 진행 중일 때, THE Galanda_UI SHALL 진행 중인 행동을 나타내는 label을 표시한다.

9.6 WHILE mutation 요청이 진행 중인 동안, THE Galanda_UI SHALL 같은 mutation의 중복 제출을 차단한다.

9.7 WHEN 서버가 mutation 성공을 확정할 때, THE Galanda_UI SHALL 성공 System_State를 표시한다.

9.8 IF mutation 요청이 실패하면, THEN THE Galanda_UI SHALL 성공 System_State 대신 오류 System_State를 표시한다.

9.9 IF form 저장이 실패하면, THEN THE Galanda_UI SHALL 사용자가 입력한 form 값을 유지한다.

9.10 IF 가격 값이 System_State에 존재하지 않으면, THEN THE Galanda_UI SHALL 가격을 미정 상태로 표시한다.

9.11 IF Revision_Conflict가 발생하면, THEN THE Galanda_UI SHALL 충돌 상태와 복구 행동을 표시한다.

9.12 THE Galanda_UI SHALL entity 값을 확정된 System_State 또는 명시적 사용자 입력에서 가져온다.

### Requirement 10: Overlay 상호작용

**User Story:** Galanda 사용자로서, drawer와 dialog가 현재 맥락을 유지하면서 명확하게 열리고 닫히기를 원한다. 그래야 실수 없이 선택 또는 확인을 완료할 수 있다.

#### Acceptance Criteria

10.1 WHEN Overlay가 열릴 때, THE Galanda_UI SHALL Overlay의 접근 가능한 역할과 제목을 제공한다.

10.2 WHILE Overlay가 열려 있는 동안, THE Galanda_UI SHALL 배경 콘텐츠와 Overlay 표면을 시각적으로 구분한다.

10.3 WHILE modal Overlay가 열려 있는 동안, THE Galanda_UI SHALL 배경 문서의 scroll을 고정한다.

10.4 WHEN Keyboard_User가 dismiss 가능한 Overlay에서 Escape를 누를 때, THE Galanda_UI SHALL Overlay를 닫는다.

10.5 WHEN 사용자가 파괴적 행동을 선택할 때, THE Galanda_UI SHALL 파괴적 결과를 명시하는 확인 dialog를 표시한다.

10.6 IF Overlay 안의 작업이 실패하면, THEN THE Galanda_UI SHALL Overlay 안에 오류 System_State를 표시한다.

### Requirement 11: 아키텍처 정합성과 검증

**User Story:** Galanda 개발자로서, UI 개선이 현재 아키텍처와 검증 체계를 유지하기를 원한다. 그래야 기능별 구현이 분기되지 않고 이후 변경을 안전하게 검토할 수 있다.

#### Acceptance Criteria

11.1 THE UI_Implementation SHALL 공통 primitive를 `src/components/ui` 경계에서 제공한다.

11.2 THE UI_Implementation SHALL Galanda 제품 공통 composition을 `src/components/galanda` 경계에서 제공한다.

11.3 THE UI_Implementation SHALL 기존 Emotion feature 스타일을 UI_Refresh에 필요한 국소 변경 범위로 유지한다.

11.4 THE UI_Implementation SHALL TDS 없이 UI_Foundation을 사용한다.

11.5 THE UI_Implementation SHALL 도메인 규칙, 서버 API, 인증, 권한, persistence, concurrency 계약을 현재 동작대로 유지한다.

11.6 WHEN UI_Refresh 구현이 완료될 때, THE Verification_Process SHALL Representative_Viewport에서 Covered_Flow의 반응형 layout을 검증한다.

11.7 WHEN UI_Refresh 구현이 완료될 때, THE Verification_Process SHALL Web_PWA와 Apps_in_Toss의 플랫폼별 navigation 소유권을 검증한다.

11.8 WHEN UI_Refresh 구현이 완료될 때, THE Verification_Process SHALL Backdrop_Filter 지원 환경과 Opaque_Fallback 환경을 각각 검증한다.

11.9 WHEN UI_Refresh 구현이 완료될 때, THE Verification_Process SHALL Reduced_Motion_Mode와 기본 motion 환경을 각각 검증한다.

11.10 WHEN UI_Refresh 구현이 완료될 때, THE Verification_Process SHALL Keyboard_User와 Screen_Reader의 Covered_Flow 완료 가능성을 검증한다.

11.11 WHEN UI_Refresh 구현이 완료될 때, THE Verification_Process SHALL Canonical_Gate를 통과한다.
