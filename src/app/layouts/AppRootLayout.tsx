import { css } from "@emotion/react";
import { Outlet } from "react-router-dom";

const containerStyle = css`
  width: 100%;
  flex: 1;
  min-height: 100vh;
  min-height: 100dvh;
  background-color: var(--background);
  display: flex;
  flex-direction: column;
  position: relative;
`;

export function AppRootLayout() {
  return (
    <div css={containerStyle}>
      <Outlet />
    </div>
  );
}
