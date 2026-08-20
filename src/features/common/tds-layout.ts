import type { CSSProperties } from "react";
import { css } from "@emotion/react";

/** TDS의 자체 여백을 살리는 기본 화면 shell이에요. */
export const tdsPageStyle = css`
  width: 100%;
  flex: 1;
  min-height: 100%;
  padding: var(--app-page-padding-top) 0 var(--app-page-padding-bottom);
`;

/** FixedBottomCTA가 가리는 마지막 콘텐츠를 위한 화면 shell이에요. */
export const tdsPageWithBottomCtaStyle = css`
  ${tdsPageStyle};
  padding-bottom: var(--app-cta-space);
`;

/** TDS가 처리하는 safe-area/키보드 동작을 덮어쓰지 않고 전체 viewport를 사용해요. */
export const fixedCtaContainerStyle: CSSProperties = {
  width: "100%",
};
