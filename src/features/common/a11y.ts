import { css } from "@emotion/react";

/**
 * 화면에서는 보이지 않지만 스크린 리더와 키보드 포커스에는 남아 있는 요소예요.
 * 시각적으로 커스텀한 라디오/체크박스의 실제 입력 요소를 감출 때 사용해요.
 */
export const visuallyHiddenStyle = css`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
`;
