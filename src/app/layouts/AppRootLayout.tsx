import { css } from "@emotion/react";
import { Outlet } from "react-router-dom";
import { useVisualKeyboardInset } from "../../hooks/useVisualKeyboardInset.ts";

const containerStyle = css`
  width: 100%;
  flex: 1;
  min-height: 100vh;
  min-height: 100dvh;
  background-color: var(--background);
  color: var(--foreground);
  display: flex;
  flex-direction: column;
  position: relative;
  /* overflow-x: hidden은 이 요소를 scroll container로 만들어 sticky header가
     viewport가 아니라 이 조상 기준으로 고정되게 해요. 가로 넘침만 막는 clip을 써요. */
  overflow-x: clip;
`;

export function AppRootLayout() {
  useVisualKeyboardInset();
  return (
    <div css={containerStyle}>
      <Outlet />
    </div>
  );
}
