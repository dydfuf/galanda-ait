import type { CSSProperties } from "react";

/**
 * 앱 셸(#root)의 최대 너비예요. `src/index.css`의 `#root` 규칙과 같은 값을 유지해야 해요.
 */
export const APP_MAX_WIDTH_PX = 480;

/**
 * TDS `FixedBottomCTA`/`BottomCTA`는 뷰포트 전체 너비에 고정돼요.
 * 앱 셸이 최대 너비를 가지므로, 고정 CTA도 같은 폭에 맞춰 정렬해요.
 *
 * 모바일 키보드가 올라올 때 문제가 되는 `bottom`/`opacity`는 지정하지 않아요.
 */
export const fixedCtaContainerStyle: CSSProperties = {
  maxWidth: `${APP_MAX_WIDTH_PX}px`,
};
