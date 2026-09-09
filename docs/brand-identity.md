# 갈라고 Brand Identity

갈라고의 사용자 노출 브랜드와 설치형 앱 에셋 계약을 정의합니다. 저장소명, package 이름,
Apps in Toss `appName`, 기존 storage key처럼 이미 배포된 `galanda` 식별자는 호환성을
위한 내부 ID이며 사용자 표시 이름으로 사용하지 않습니다.

## 브랜드 원칙

- **표시 이름:** `갈라고`
- **Primary:** `#3182F6`
- **마크:** 둥근 `G` 실루엣 안에 하나의 직선 경로와 종착점을 둡니다.
- **역할 분리:** 브랜드 마크는 flat, 제품 기능 아이콘은 `GalandaIcon`, 상태 안내는
  `GalandaSpot` 입체 일러스트를 사용합니다. 서로 확대·축소해 대체하지 않습니다.
- **테마 독립:** 앱 아이콘/파비콘은 라이트·다크 변형을 만들지 않습니다. 동일한 브랜드
  파랑과 흰색 마크를 사용합니다.

## Source of truth

| 파일 | 역할 |
| --- | --- |
| `public/assets/galanda/brand/mark.svg` | 투명 배경에서 사용하는 마크 geometry |
| `public/assets/galanda/brand/app-icon.svg` | 설치 아이콘의 master composition |
| `public/favicon.svg` | 48px 브라우저 탭용 파생 SVG |
| `public/pwa/icon-192.png` | PWA 일반 아이콘 |
| `public/pwa/icon-512.png` | PWA 고해상도 일반 아이콘 |
| `public/pwa/icon-maskable-512.png` | PWA maskable 아이콘 |
| `public/pwa/apple-touch-icon.png` | iOS 홈 화면 아이콘 |

앱 아이콘의 중요한 흰색 마크는 512 좌표계에서 중심으로부터 최대 164px 안에 있어
maskable safe zone(중심 반경 40% = 204.8px) 안에 충분히 들어옵니다. 배경은 가장자리까지
`#3182F6`으로 채워 어떤 시스템 마스크에서도 빈 모서리가 생기지 않게 합니다.

## 파생 규칙

1. `app-icon.svg`의 도형·primary color를 먼저 변경합니다.
2. PNG 4종을 같은 composition에서 다시 export합니다. 런타임 이미지 라이브러리나
   별도 SVG loader를 추가하지 않습니다.
3. favicon은 같은 마크 geometry를 유지하되 브라우저 탭에서 사각형이 과하게 보이지
   않도록 background corner만 둥글게 합니다.
4. `src/brand-identity.test.ts`의 크기·approved digest를 갱신하는 변경은 시각 검토와
   함께 수행합니다. digest만 바꾸어 실패를 숨기지 않습니다.
5. `index.html`, `vite.config.ts`, Apps in Toss의 primary color 계약을 함께 확인합니다.

## 사용자 표시 이름과 내부 식별자

사용자에게 보이는 `<title>`, application name, Apple web app title, PWA manifest의
name/short name/description은 `갈라고`를 사용합니다. 반대로 아래 값은 기존 배포·저장
호환성을 위해 의도적으로 유지합니다.

- repository/package 및 코드 경로의 `galanda`
- Apps in Toss `appName: "galanda"`
- `galanda_theme_v1`을 포함한 기존 storage key
- 기존 API/DB 식별자와 migration 이름

브랜드 변경을 이유로 이 내부 식별자를 rename하지 않습니다.
