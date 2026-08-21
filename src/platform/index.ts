import { platformAdapter, platformRoutes } from "@platform/current";

export type {
  AccessoryButtonOptions,
  PlatformAdapter,
  PlatformNavigation,
  PlatformRoute,
  ShareMessage,
  ShareOutcome,
} from "./types.ts";

/**
 * 현재 빌드 타깃의 플랫폼 어댑터예요.
 * 구현 선택은 런타임이 아니라 빌드 타임에 이뤄져요 (`@platform/current` alias).
 */
export const platform = platformAdapter;

/** 현재 빌드 타깃에만 존재하는 라우트예요. */
export const platformOnlyRoutes = platformRoutes;
