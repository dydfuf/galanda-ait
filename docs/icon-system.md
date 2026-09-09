# Galanda icon system

제품 UI용 24×24 벡터 아이콘입니다. 일러스트, 앱/PWA 로고, 네이티브 AIT accessory와는 별도입니다.
기존 승인된 16종을 보존하고 공통 조작·상태·여행·협업·설정 64종을 추가해 **80종 / SVG 85개**를 제공합니다.
이 숫자는 현재 기본 세트의 크기이며, 이후 모든 특수 기능에 새 아이콘이 전혀 필요 없다는 보장은 아닙니다.

## 사용

```tsx
import { GalandaIcon } from "@/components/galanda/galanda-icon.tsx";

<Button type="button" onClick={onSearch}>
  <GalandaIcon name="search" size={20} />
  검색
</Button>

<Button type="button" aria-label="닫기" onClick={onClose}>
  <GalandaIcon name="close" size={20} />
</Button>

<GalandaIcon name="bookmark" variant={saved ? "filled" : "outline"} size={20} />
```

`name`과 `variant`는 SVG 원본에서 생성한 타입으로 제한됩니다. Filled는 실제 원본이 있는
home/explore/trips/my/bookmark에만 허용합니다. 잘못된 이름을 조용히 빈 그림으로 대체하지 않습니다.
기본 24px, 행동·목록 20px, 작은 메타데이터 16px입니다. `className`은 색상/정렬에 사용하고
임의의 크기·fill·stroke 변경으로 규격을 우회하지 않습니다. 그림의 크기는 44px 이상 터치 영역을 대신하지 않습니다.

`currentColor`가 버튼/텍스트의 semantic token을 상속합니다. 밝은 배경을 가정한 흰색 도형이나
하드코딩 색상이 없으며 라이트/다크 파일을 따로 만들지 않습니다. 원본을 `<img>`로 렌더링하면
부모의 color를 상속하지 않으므로 앱에서는 인라인 `GalandaIcon`을 사용합니다.

SVG는 항상 `aria-hidden`, `focusable=false`인 장식입니다. 보이는 한글 라벨이나 컨트롤의
접근 가능한 이름을 유지합니다. 색상만으로 상태를 전달하지 않습니다. pending Spinner,
aria-pressed, disabled, 실패/오프라인 문구와 상태 복구는 기존 기능 코드가 소유합니다.

## 찾기와 미리보기

개발 서버에서 **`/dev/icons`**를 엽니다. 영문 이름/한글 의미 검색, 분류, 16/20/24px,
기존 시스템/라이트/다크 테마 전환, outline/filled 원본 받기를 제공합니다.
`import.meta.env.DEV`로 lazy import와 route를 함께 제한하므로 production에는 이 화면을 등록하지 않습니다.
카탈로그는 기존 테마 공급자를 사용하며, 선택한 테마는 다른 개발 화면에도 적용됩니다.

| 분류 | 종수 | 범위 |
| --- | ---: | --- |
| navigation | 4 | 홈·탐색·내 여행·마이 (라인/채움) |
| planning | 4 | 일정·경로·숙소·예약 티켓 |
| actions | 4 | 여행 만들기·동행·초대·임시 저장 완료 |
| decision | 4 | 비교·보관·가져오기·공유 (북마크 라인/채움) |
| interface | 29 | 검색·필터·정렬·추가·빼기·닫기·방향/chevron·편집·삭제·복제·더보기·링크·외부 링크·업로드·새로고침·되돌리기·다시 실행·목록·그리드·첨부·문서·사진 |
| status | 8 | 선택 체크·안내·도움말·주의·오류·시간·알림·오프라인 |
| travel | 14 | 장소·지도·길찾기·항공·기차·버스·자동차·도보·식사·카페·촬영·예산·영수증·결제 |
| collaboration | 6 | 의견·보내기·좋아요·괜찮아요·어려워요·목적지/언어 |
| preferences | 7 | 설정·화면 설정·라이트·다크·시스템·잠금·로그아웃 |

카탈로그에 있는 미래 기능용 아이콘은 기능 구현 완료를 뜻하지 않습니다. 결제/도보 등의
아이콘을 보여주려고 존재하지 않는 버튼이나 데이터를 추가하지 않습니다.

## 상태 의미

- `bookmark`: 공개 여행안을 내 보관 목록에 저장함. 로컬 임시 저장 성공과 다릅니다.
- `complete`: 호출부가 확인한 작업 완료. 현재 편집 헤더에서는 `SAVED`인 로컬 임시 저장에만 사용합니다.
- `check`: 선택 표시. 여행 확정·예약 완료·저장 성공을 임의로 의미하지 않습니다.
- `ticket`: 예약 항목/정보. 예약 완료 배지가 아닙니다.
- `invite`는 동행자 초대, `share`는 링크 전달입니다. 네이티브 AIT icon-share-mono는 교체하지 않습니다.
- `thumbs-up`/`meh`/`frown`은 LIKE/OKAY/HARD 표시 후보입니다. 기존 반응 의미·순서·권한을 변경하지 않습니다.

## 원본에서 생성

Source of truth는 `public/assets/galanda/<category>/*-outline.svg`와 선택적 `*-filled.svg`,
그리고 `src/components/galanda/icons/labels.json`의 한글 이름입니다.

```bash
node scripts/generate-icons.mjs
node scripts/generate-icons.mjs --check
pnpm exec vitest run src/components/galanda/galanda-icon.test.tsx src/components/galanda/icons/icon-compiler.test.ts src/features/dev/DevIconsPage.test.tsx
pnpm check
```

생성기는 `icons/icon-nodes.ts`와 `icons/catalog.ts`를 갱신합니다. 생성된 두 파일을 수작업으로
편집하지 않습니다. 원본·이름·생성 파일을 같은 PR에 커밋합니다. 빌드 때 생성하는 단계나
런타임 XML 파싱, SVG 로더, 새 패키지는 없습니다. React는 검증된 정적 노드만 생성합니다.

지원 입력은 단일 24×24 root와 평평한 path/rect/circle/ellipse/line/polyline/polygon입니다.
script/image/foreignObject/group, URL/이벤트/외부 참조, 임의 색상·선 두께를 거부합니다.
이는 저장소의 신뢰된 정적 에셋용 컴파일러이지 사용자 업로드 SVG 정화 서비스가 아닙니다.

동일 이름의 다른 분류 중복, outline 누락, 한글 이름 누락/유령 항목은 생성 실패입니다.
원본과 React 렌더러의 형상·색상·크기 일치, 생성 파일 최신 여부, 접근성, 지원하지 않는
입력 거부를 기존 Vitest gate에서 검사합니다. 타입 fixture는 잘못된 name/variant/size를 거부하는지 검사합니다.

## 기존 코드 호환과 적용 범위

`PlanningIcon`, `ActionIcon`, `DecisionIcon`은 기존 props와 data-slot을 유지하는 얇은
호환 wrapper이며 이제 `GalandaIcon`을 사용합니다. 이 세 렌더러에는 형상을 중복 복사하지 않습니다.
기존 저장 실패 rollback·완료 표시·링크/공유 동작 테스트를 그대로 유지합니다.
`GlobalNavIcon`은 기존 선택 상태와 root 속성 계약을 보존하기 위해 그대로 둡니다.
내비게이션 원본 형상을 바꿀 때만 원본, GlobalNavIcon, 생성 파일을 함께 갱신합니다.

새 공통 아이콘은 PageHeader의 뒤로 가기, MobileList의 chevron, OfflineStatusBanner,
마이의 보관/화면 설정/테마 선택에 적용합니다. 새로운 기능 화면에서는 카탈로그를 먼저 찾습니다.
기존 shadcn primitive 내부의 Lucide와 그 밖의 미전환 아이콘은 필요한 범위에서 계속 사용할 수 있습니다.
라이브러리 제거를 위해 동작하는 primitive 전체를 다시 작성하지 않습니다.

## 새 아이콘의 완료 조건

기존 의미와 중복하지 않는 이름을 선택하고 같은 그리드·2px round stroke·currentColor로 만듭니다.
16/20/24px에서 식별과 잘림을 확인하고 라이트/다크 문맥에서 기존 텍스트와 함께 검토합니다.
outline/filled 상태가 필요하면 원본과 의미를 명시하며 단순 장식용으로 상태를 만들지 않습니다.
생성·원본 일치 검사와 전체 gate를 통과시킵니다. 실제 앱 화면을 변경했다면 브라우저 검증 결과와
미검증 범위를 구분해서 PR에 기록합니다. 이미지 시트/DOM 검사만으로 앱·PWA·AIT 실기기 검증을 대체하지 않습니다.
