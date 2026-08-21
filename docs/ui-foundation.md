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

## 컴포넌트 추가 방법

```bash
npx shadcn@latest add <component>
```

`components.json`이 Base UI(`base-nova` style) 기준으로 설정되어 있어 생성물은
자동으로 Base UI 기반이 됩니다. 필요한 컴포넌트만 추가하고, 미리 전부 설치하지
않습니다.
