import { GalandaIcon } from "./galanda-icon.tsx";

// This file is compiled, not executed. Negative cases protect the public API.
export const iconTypeContract = [
  <GalandaIcon key="plane" name="plane" size={20} />,
  <GalandaIcon key="bookmark" name="bookmark" variant="filled" />,
  <GalandaIcon key="home" name="home" variant="filled" />,
  // @ts-expect-error There is no silent missing-icon fallback.
  <GalandaIcon key="invalid-name" name="missing-icon" />,
  // @ts-expect-error Filled is only available for icons with a filled source.
  <GalandaIcon key="invalid-variant" name="plane" variant="filled" />,
  // @ts-expect-error Use a supported UI size, not illustration dimensions.
  <GalandaIcon key="invalid-size" name="search" size={128} />,
  // @ts-expect-error Accessible labels belong to the surrounding control.
  <GalandaIcon key="invalid-title" name="search" title="검색" />,
];
