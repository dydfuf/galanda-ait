# Galanda TDS UI foundation

Apps in Toss 화면은 웹 컨테이너가 아니라 흰색 surface 위의 TDS 화면으로 구성한다.

## 화면 문법

| 목적 | 기본 컴포넌트 |
| --- | --- |
| 페이지 제목·설명 | `Top` |
| 반복 정보의 제목 | `ListHeader` |
| 반복 정보·탐색 행 | `List` + `ListRow` |
| 짧은 상태 | `Badge` |
| 핵심 완료 행동 | `FixedBottomCTA` 또는 `BottomCTA` 하나 |
| 사용자 입력 | `TextField` 또는 TDS 입력 컴포넌트 |
| 구분 | spacing, typography, `Border` |
| 확인·삭제 | TDS `BottomSheet`/dialog 패턴 |

## 공통 규칙

- `body`, `#root`, `AppRootLayout`은 `adaptiveBackground`를 기본 surface로 사용한다.
- 화면 공통 safe-area와 CTA 하단 여백은 `src/index.css`의 `--safe-*`, `--app-*` 토큰과 `src/features/common/tds-layout.ts`에서 관리한다.
- 로딩은 TDS `Loader`, 빈 상태와 오류는 `PageState`를 사용한다. 오류에는 가능한 경우 `다시 시도`를 제공한다.
- generic card, custom badge, action box, text input을 새로 만들지 않는다. 필요한 경우 먼저 TDS primitive로 표현한다.
- `RouteRail`과 여행안 차이 요약처럼 여행 의사결정에만 필요한 시각화는 제품 고유 컴포넌트로 유지한다.

## Apps in Toss shell ownership

- 토스 앱에서는 shell이 back/title/accessory를 소유한다. `TripRoom*Layout`과 생성 화면은 앱 환경에서 자체 `TopNavigation`을 렌더링하지 않는다.
- 브라우저에서는 TDS `TopNavigation`을 fallback으로 사용해 키보드·뒤로가기 테스트를 계속할 수 있다.
- 공유는 `Share.sendMessage`를 먼저 사용하고, 미지원 환경은 Web Share와 `Clipboard`/브라우저 clipboard 순서로 복구한다. 완료·실패 안내는 `useToast`를 사용한다.
- 삭제·초기화·확정은 `useBottomSheet`의 명확한 취소/주요 행동 label을 사용하며 `window.alert`와 `window.confirm`은 사용하지 않는다.

새 화면은 `Top → ListHeader/ListRow → BottomCTA` 조합을 먼저 검토하고, 카드 CSS는 이 조합으로 정보를 표현할 수 없을 때만 사용한다.
