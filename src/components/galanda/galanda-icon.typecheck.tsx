import { GalandaIcon } from "./galanda-icon.tsx";

// This file is compiled, not executed. Negative cases protect the public API.
export const iconTypeContract = [
  <GalandaIcon name="plane" size={20} />,
  <GalandaIcon name="bookmark" variant="filled" />,
  <GalandaIcon name="home" variant="filled" />,
  // @ts-expect-error There is no silent missing-icon fallback.
  <GalandaIcon name="missing-icon" />,
  // @ts-expect-error Filled is only available for icons with a filled source.
  <GalandaIcon name="plane" variant="filled" />,
  // @ts-expect-error Use a supported UI size, not illustration dimensions.
  <GalandaIcon name="search" size={128} />,
  // @ts-expect-error Accessible labels belong to the surrounding control.
  <GalandaIcon name="search" title="검색" />,
];
